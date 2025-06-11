---
title: 'Merging objects with Partial type'
slug: 'merging-objects-with-partial-type'
icon: ''
created_time: '2017-11-16T00:00:00.000Z'
last_edited_time: '2023-12-30T10:11:00.000Z'
category: 'Tech'
tags:
  - 'TypeScript'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/Merging-objects-with-Partial-type-eb888a6f797f4562907a2adb7ea9d36a'
features:
  katex: false
  mermaid: false
  tweet: false
---

My usual implementation pattern of immutable merging in TypeScript.

```
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
