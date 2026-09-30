/**
 * Tiny argv parser. Avoids pulling in commander/yargs for what amounts to
 * a handful of flags. Supports `--key value` and `--key=value`, repeatable
 * flags get stored as string[].
 */

export type ParsedArgs = {
  command: string | undefined
  positional: string[]
  flags: Record<string, string | string[] | true>
}

export function parseArgs(argv: string[]): ParsedArgs {
  const [, , command, ...rest] = argv
  const positional: string[] = []
  const flags: Record<string, string | string[] | true> = {}

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]
    if (!arg) continue
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=')
      let key: string
      let value: string | undefined
      if (eq >= 0) {
        key = arg.slice(2, eq)
        value = arg.slice(eq + 1)
      } else {
        key = arg.slice(2)
        const next = rest[i + 1]
        if (next !== undefined && !next.startsWith('--')) {
          value = next
          i += 1
        }
      }
      const existing = flags[key]
      if (value === undefined) {
        flags[key] = true
      } else if (existing === undefined) {
        flags[key] = value
      } else if (Array.isArray(existing)) {
        existing.push(value)
      } else if (typeof existing === 'string') {
        flags[key] = [existing, value]
      } else {
        flags[key] = value
      }
    } else {
      positional.push(arg)
    }
  }

  return { command, positional, flags }
}

export function requireFlag(args: ParsedArgs, name: string): string {
  const v = args.flags[name]
  if (typeof v !== 'string' || !v) {
    throw new Error(`Missing required flag --${name}`)
  }
  return v
}

export function optionalFlag(args: ParsedArgs, name: string): string | undefined {
  const v = args.flags[name]
  return typeof v === 'string' ? v : undefined
}

export function boolFlag(args: ParsedArgs, name: string): boolean {
  const v = args.flags[name]
  return v === true || v === 'true' || v === '1'
}
