// Runtime-built specifiers keep Vite from resolving a missing file while it transforms a spec.
const target = '@target'
const tools = '@tools'
export const loadSrc = (rel: string) => import(/* @vite-ignore */ `${target}/${rel}`)
export const loadTool = (rel: string) => import(/* @vite-ignore */ `${tools}/${rel}`)
