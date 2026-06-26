export const UPDATE_KEY = {
  currentDate: "$currentDate",
  inc: "$inc",
  min: "$min",
  max: "$max",
  mul: "$mul",
  rename: "$rename",
  set: "$set",
  setOnInsert: "$setOnInsert",
  unset: "$unset",
  addToSet: "$addToSet",
  pop: "$pop",
  pull: "$pull",
  push: "$push",
  pullAll: "$pullAll",
  bit: "$bit",
} as const;
export const updateKeysArray = getArrayFromObjectValues(UPDATE_KEY);

export function getArrayFromObjectValues<T extends Record<string | number, unknown>>(
  obj: T,
): T[keyof T][] {
  return Object.values(obj) as [T[keyof T]];
}
