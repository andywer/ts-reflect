# type-reflect

TypeScript transformation plugin that provides access to TypeScript type information at runtime. Comes with a validation function and a type-checking `JSON.parse()`.

⚠️ Status: Experimental


## Installation

```sh
$ npm install type-reflect
```


## Usage

Accessing type information in your code is easy:

```ts
import Reflect from "type-reflect"

interface User {
  id: string | number,
  name: string,
  role: "admin" | "read-write" | "read-only"
}

export const schema = Reflect<User>()

/*
  The `Reflect<>()` call will be transpiled to:

  export const schema = {
    type: "object",
    title: "User",
    properties: {
      id: {
        type: ["string", "number"]
      },
      name: {
        type: "string"
      },
      role: {
        type: "string",
        enum: ["admin", "read-write", "read-only"]
      }
    },
    required: ["id", "name", "role"]
  }
 */
```

### Compilation

To transpile the TypeScript code using the `type-reflect` transformation, use the [`ts` compiler](https://github.com/andywer/ts):

```sh
$ ts --transform type-reflect/transform ./source.ts
```

To permanently use the transformation in your project, add this configuration to your `package.json`:

```js
{
  // ...
  "ts": {
    "transforms": [
      "type-reflect"
    ]
  }
}
```

Note that you cannot use the standard `tsc`, since it does not expose the transformation API.


## Validating data

```ts
import { validate } from "type-reflect/validate"
import { getUser } from "./user"
import { schema } from "./user-schema"

const user = validate(getUser(), schema)

// Will throw an error if the return value of `getUser()` does not match the schema
// TypeScript can automatically infer that `user` is of type `User` after validation
```


## Validated JSON parsing

```ts
import { parseJSON } from "type-reflect/validate"
import { schema } from "./user-schema"

const json = `{
  "id": 1,
  "name": "Me",
  "role": "read-write"
}`

const user = parseJSON(json, schema)

// Will throw an error if the JSON data does not match the schema
// TypeScript can automatically infer that `user` is of type `User`
```

## Known Limitations

- Generic types / interfaces do not work correctly yet (generic type arguments don't work)
- Tuples are casted to `any[]` right now


## License

MIT