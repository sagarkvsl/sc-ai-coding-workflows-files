// Imports go through a runtime-built specifier so that Vite does not resolve
// them while transforming the spec file. A missing module then fails only the
// tests that need it, instead of removing the whole spec file from the run.
const BASE = '@target'
const load = (rel: string) => import(/* @vite-ignore */ `${BASE}/${rel}`)

export const loadApp = () => load('App')
export const loadProvider = () => load('state/TaskContext')
export const loadReducer = () => load('state/taskReducer')
export const loadSelectors = () => load('state/selectors')
export const loadDate = () => load('utils/date')
export const loadId = () => load('utils/id')
export const loadTypes = () => load('types/task')
export const loadUseTasks = () => load('hooks/useTasks')
