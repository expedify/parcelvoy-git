import { ModelParams } from '../core/Model'
import { User } from '../users/User'
import { UserEvent } from '../users/UserEvent'
import Rule, { RuleEvaluation, RuleTree } from './Rule'
import { check } from './RuleEngine'

export type RuleWithEvaluationResult = Omit<Rule, ModelParams | 'equals'> & { result?: boolean }

interface EvaluationId {
    evaluation_id: number
    parent_uuid: string
    root_uuid: string
}

type RuleWithEvaluationId = Rule & EvaluationId
type RuleTreeWithEvaluationId = RuleTree & EvaluationId
export type RuleResults = { success: string[], failure: string[] }

/**
 * For a given user and set of rules joined with evaluation results,
 * check if all rules are true.
 *
 * This is the fastest option available for checking a rule set since it
 * uses cached values.
 */
export const checkRules = (user: User, root: Rule | RuleTree, rules: RuleWithEvaluationResult[]) => {
    const predicate = (rule: RuleWithEvaluationResult) => {
        return rule.group === 'user'
            ? check({ user: user.flatten(), events: [] }, rule as Rule)
            : rule.result ?? false
    }
    if (root.operator === 'or') return rules.some(predicate)
    if (root.operator === 'none') return !rules.some(predicate)
    if (root.operator === 'xor') return rules.filter(predicate).length === 1
    return rules.every(predicate)
}

/**
 * For a provided root rule UUID of a set, fetch the associated rules
 * and check if the entire rule set is true.
 *
 * This uses cached result values for evaluations.
 */
export const checkRootRule = async (uuid: string, user: User) => {
    const [root, ...rules] = await Rule.all(qb => qb
        .leftJoin('rule_evaluations', function() {
            this.on('rule_evaluations.rule_id', 'rules.id')
                .andOn('rule_evaluations.user_id', Rule.raw(user.id))
        })
        .where('parent_uuid', uuid)
        .orWhere('uuid', uuid)
        .select('rules.*', 'result'),
    ) as Array<Rule & { result?: boolean }>
    return checkRules(user, root, rules)
}

/**
 * Find all of the rules that are associated to the provided event along
 * with if that event moves a rule set from false to true or vice versa.
 *
 * Uses the provided event to calculate a new evaluation result (cache)
 * for each rule.
 */
export const matchingRulesForEvent = async (user: User, event: UserEvent): Promise<RuleResults> => {

    // Get all rules where the event name matches and the evaluation is false
    const children = await Rule.all(qb => qb
        .leftJoin('rules as p', function() {
            this.on('p.uuid', 'rules.parent_uuid').orOn('p.uuid', 'rules.uuid')
        })
        .leftJoin('rule_evaluations', function() {
            this.on('rule_evaluations.rule_id', 'p.id')
                .andOn('rule_evaluations.user_id', Rule.raw(user.id))
        })
        .where('p.value', event.name)
        .where('p.group', 'event')
        .where('p.type', 'wrapper')
        .where('rules.project_id', user.project_id)
        .select('rules.*', 'rule_evaluations.id as evaluation_id'),
    ) as Array<RuleWithEvaluationId>

    // Build nodes out of results
    const nodes = children
        .filter(child => child.parent_uuid === child.root_uuid)
        .map(child => compileRule(child, children) as RuleTreeWithEvaluationId)

    // Iterate through all rules to see if any are true and need to be updated
    const success: string[] = []
    const failure: string[] = []
    for (const node of nodes) {
        const result = await checkEventRule(node, user, event)
        result
            ? success.push(node.root_uuid!)
            : failure.push(node.root_uuid!)
    }
    return { success, failure }
}

export const matchingRulesForUser = async (user: User): Promise<RuleResults> => {
    const rules = await Rule.all(qb =>
        qb.where('rules.group', 'parent')
            .where('rules.type', 'wrapper')
            .where('project_id', user.project_id),
    )

    const success = []
    const failure = []
    for (const rule of rules) {
        const result = await checkRootRule(rule.uuid, user)
        result
            ? success.push(rule.uuid)
            : failure.push(rule.uuid)
    }
    return { success, failure }
}

const checkEventRule = async (
    node: RuleTreeWithEvaluationId,
    user: User,
    event: UserEvent,
): Promise<boolean> => {
    const evaluationId = node.evaluation_id
    const result = check({
        user: user.flatten(),
        events: [event.flatten()],
    }, node)

    // If event is true, update the evaluation and recheck parent rule
    if (result) {
        evaluationId
            ? await RuleEvaluation.update(
                qb => qb
                    .where('rule_id', node.id)
                    .where('user_id', user.id),
                { result: true },
            )
            : await RuleEvaluation.insert({
                rule_id: node.id,
                user_id: user.id,
                result: true,
            })
        return await checkRootRule(node.root_uuid!, user)
    }
    return false
}

/**
 * For a given new rule tree intelligently merge with the existing rules
 */
export const mergeInsertRules = async (newRules: Rule[]) => {
    const [wrapper, ...rules] = newRules
    const previousRules = await Rule.all(qb => qb.where('root_uuid', wrapper.uuid))

    const newItems = []
    const removedItems: number[] = []
    for (const item of rules) {
        const previous = previousRules.find(r => r.uuid === item.uuid)
        if (previous && !previous.equals(item)) {
            removedItems.push(previous.id)
            newItems.push({ ...item, id: undefined })
        }
        if (!previous) newItems.push(item)
    }

    for (const item of previousRules) {
        const previous = rules.find(r => r.uuid === item.uuid)
        if (!previous) {
            removedItems.push(item.id)
        }
    }

    await Rule.delete(qb => qb.whereIn('id', removedItems))
    if (newItems.length) await Rule.insert(newItems)

    return newItems
}

/**
 * For a given root ID value of a rule set, find all children and compile
 * into a nested tree structure.
 */
export const fetchAndCompileRule = async (rootId: number): Promise<RuleTree | undefined> => {
    const root = await Rule.find(rootId)
    if (!root) return undefined

    const rules = await Rule.all(qb => qb.where('root_uuid', root!.uuid))
    return compileRule(root, rules)
}

export const compileRule = (root: Rule, rules: Rule[]): RuleTree => {
    const build = ({ uuid, project_id, created_at, updated_at, ...rest }: Rule): RuleTree => {
        const children = rules.filter(rule => rule.parent_uuid === uuid)
        return {
            ...rest,
            uuid,
            children: children.map(build),
        }
    }

    return build(root)
}

/**
 * For a given nested rule tree, decompile into a list for insertion into
 * the database.
 */
export const decompileRule = (rule: RuleTree, extras?: any): Rule[] => {
    const rules: Rule[] = []
    const build = ({ children, ...rule }: RuleTree) => {
        rules.push(Rule.fromJson({ ...rule, ...extras }))
        if (children) {
            for (const child of children) {
                build(child)
            }
        }
    }
    build(rule)
    return rules
}
