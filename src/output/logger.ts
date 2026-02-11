let verbose = false

export function setVerbose(v: boolean) {
  verbose = v
}

function timestamp(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false })
}

function fmt(prefix: string, color: string, msg: string): string {
  return `${color}[${timestamp()}] ${prefix}\x1b[0m ${msg}`
}

export const log = {
  info(msg: string) {
    console.log(fmt("INFO", "\x1b[36m", msg))
  },
  success(msg: string) {
    console.log(fmt(" OK ", "\x1b[32m", msg))
  },
  warn(msg: string) {
    console.log(fmt("WARN", "\x1b[33m", msg))
  },
  error(msg: string) {
    console.error(fmt(" ERR", "\x1b[31m", msg))
  },
  debug(msg: string) {
    if (verbose) console.log(fmt(" DBG", "\x1b[90m", msg))
  },
  worker(id: string, msg: string) {
    console.log(fmt(`W:${id.slice(0, 6)}`, "\x1b[35m", msg))
  },
  judge(msg: string) {
    console.log(fmt("JUDGE", "\x1b[33m", msg))
  },
  iteration(n: number, max: number) {
    console.log(`\n\x1b[1m--- Iteration ${n}/${max} ---\x1b[0m\n`)
  },
}
