---
title: "Merging objects with Partial type"
date: 2017-11-16T07:34:20Z
tags: ["typescript"]
---

My usual implementation pattern of immutable merging in TypeScript.

```ts
class MyClass {
  constructor(public id: string, public name: string) {}

  clone() {
    return new MyClass(this.id, this.name);
  }

  merge(another: Partial<MyClass>) {
    return Object.assign(this.clone(), another);
  }
}

const objA = new MyClass("1", "foo");

const objB = objA.merge({ name: "bar" });

console.log(objA !== objB);
console.log(objB.id === "1");
console.log(objB.name === "bar");
```

`Partial<MyClass>` allows us to pass an object matching `MyClass` partially.
