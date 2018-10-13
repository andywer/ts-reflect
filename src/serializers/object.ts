import ts from "typescript"
import {
  ArrayType,
  BuiltinType,
  GetTypeForSymbolAtFn,
  IntrinsicType,
  ObjectType,
  SerializeTypeFn,
  TypeSchema
} from "./_types"

function dedupe<T> (array: T[]): T[] {
  return Array.from(new Set(array))
}

function includesAll<T> (array: T[], expectedElements: T[]) {
  return expectedElements.every(expectedElement => array.indexOf(expectedElement) > -1)
}

function isArraySymbol (symbol: ts.Symbol) {
  if (symbol.name === "Array" && symbol.members) {
    const memberKeys: string[] = Array.from(symbol.members.keys() as any)
    return includesAll(memberKeys, [
      "length",
      "pop",
      "push",
      "join",
      "shift",
      "slice",
      "sort"
    ])
  }
  return false
}

function isDateSymbol (symbol: ts.Symbol) {
  if (symbol.name === "Date" && symbol.members) {
    const memberKeys: string[] = Array.from(symbol.members.keys() as any)
    return includesAll(memberKeys, [
      "toString",
      "toDateString",
      "toISOString",
      "toTimeString",
      "valueOf",
      "getDate",
      "getTime"
    ])
  }
  return false
}

function isPromiseSymbol (symbol: ts.Symbol) {
  if (symbol.name === "Promise" && symbol.members) {
    const memberKeys: string[] = Array.from(symbol.members.keys() as any)
    return includesAll(memberKeys, [
      "catch",
      "then"
    ])
  }
  return false
}

function serializeMembers (members: ts.Symbol[], serializeType: SerializeTypeFn, getTypeForSymbolAt: GetTypeForSymbolAtFn): ObjectType["properties"] {
  const serialized: ObjectType["properties"] = {}

  for (const symbol of members) {
    const memberType = getTypeForSymbolAt(symbol)
    serialized[symbol.getName()] = serializeType(memberType)
  }

  return serialized
}

function serializeTuple (type: ts.ObjectType): ArrayType | null {
  if (type.flags & ts.TypeFlags.Object) {
    const { objectFlags } = type as ts.ObjectType

    if (objectFlags & ts.ObjectFlags.Tuple) {
      return {
        type: IntrinsicType.array,
        items: {
          type: IntrinsicType.any
        }
      }
    }
  }
  return null
}

function serializeBuiltin (type: ts.ObjectType, serializeType: SerializeTypeFn): ArrayType | BuiltinType<any> | null {
  const { objectFlags } = type
  const symbol = type.getSymbol()

  if (symbol && isArraySymbol(symbol) && (objectFlags & ts.ObjectFlags.Reference)) {
    const { typeArguments } = type as ts.TypeReference
    return {
      type: IntrinsicType.array,
      items: typeArguments && typeArguments.length === 1
        ? serializeType(typeArguments[0])
        : { type: IntrinsicType.any }
    }
  } else if (symbol && isDateSymbol(symbol)) {
    return {
      "$ref": "runtime#date"
    }
  } else if (symbol && isPromiseSymbol(symbol)) {
    return {
      "$ref": "runtime#promise"
    }
  }
  return null
}

function serializeObjectType (type: ts.Type, serializeType: SerializeTypeFn, getTypeForSymbolAt: GetTypeForSymbolAtFn): TypeSchema | null {
  if (type.flags & ts.TypeFlags.Object) {
    const { objectFlags } = type as ts.ObjectType
    let inheritedTypes: ObjectType[] = []

    const serializedBuiltin = serializeBuiltin(type as ts.ObjectType, serializeType)
    if (serializedBuiltin) return serializedBuiltin

    const serializedTuple = serializeTuple(type as ts.ObjectType)
    if (serializedTuple) return serializedTuple

    if ((objectFlags & ts.ObjectFlags.Reference) && (type as ts.TypeReference).target !== type) {
      const serializedReference = serializeObjectType((type as ts.TypeReference).target, serializeType, getTypeForSymbolAt)
      if (serializedReference) return serializedReference
    }

    if (objectFlags & ts.ObjectFlags.Interface) {
      const baseTypes = (type as ts.InterfaceType).getBaseTypes()

      if (baseTypes) {
        inheritedTypes = baseTypes
          .map(baseType => serializeObjectType(baseType, serializeType, getTypeForSymbolAt))
          .filter(serializedBaseType => serializedBaseType && serializedBaseType.type === "object") as ObjectType[]
      }
    }

    const inheritedMembers = inheritedTypes.reduce(
      (object, inheritedType) => ({ ...object, ...inheritedType.properties }),
      {} as ObjectType["properties"]
    )

    const symbol = type.getSymbol()
    const members = serializeMembers((type as ts.ObjectType).getProperties(), serializeType, getTypeForSymbolAt)

    // TODO: For all properties: If it's a union of [*, undefined], normalize to * and strip from `required`

    return {
      type: IntrinsicType.object,
      title: symbol ? symbol.getName() : undefined,
      properties: {
        ...inheritedMembers,
        ...members
      },
      required: dedupe([
        ...Object.keys(inheritedMembers || {}),
        ...Object.keys(members || {})
      ])
    }
  } else {
    return null
  }
}

export default [ serializeObjectType ]
