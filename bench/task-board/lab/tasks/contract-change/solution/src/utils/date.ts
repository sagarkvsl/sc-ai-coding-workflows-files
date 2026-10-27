import type { Task } from '../types/task'

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function isPastDate(dueDate: string, today: Date): boolean {
  return ISO_DATE.test(dueDate) && dueDate < toIsoDate(today)
}

export function isOverdue(
  task: Pick<Task, 'dueDate' | 'status'>,
  today: Date,
): boolean {
  const { dueDate, status } = task
  return dueDate !== null && status !== 'done' && isPastDate(dueDate, today)
}

export function formatDueDate(dueDate: string): string {
  const match = ISO_DATE.exec(dueDate)
  if (match === null) return dueDate
  const [, year, month, day] = match
  const monthName = MONTHS[Number(month) - 1]
  if (monthName === undefined) return dueDate
  return `Due ${Number(day)} ${monthName} ${year}`
}
