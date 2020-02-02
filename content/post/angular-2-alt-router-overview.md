+++
date = "2016-04-30T20:24:46+09:00"
title = "Angular 2 New Router Overview"

+++

EDIT(2016-05-02):

- Add a section for wildcard route
- Update from `Tree<RouteSegment>` to `RouteTree`
- Add a part of `router-link-active` class

---

Angular core team (mainly [@victorsavkin](https://twitter.com/victorsavkin)) is developing new router package; **angular2/alt_router**.
It's still experimental but its APIs are easier and more intuitive than _old_ angular2/router.
Let's figure out overview of next generation router!

CAUTION: **Every contents in this article can be always deprecated.**

<!--more-->

## `@RouterConfig` to `@Routes`
In order to declare a setting of routing, we have to use `Routes` decorator like old `RouteConfig`.
But its element is so simple, which has only two properties; `path` and `component`.

```ts
@Component({...})
class UserComponent {
}

@Component({...})
@Routes([
    new Route({path: "/user/:name", component: UserComponent })
])
class TeamComponent {
}

@Component({...})
@Routes([
    {path: "/team/:id", component: TeamComponent}
])
class AppRootComponent {
}
```

And **wildcards** are supported.

```
@Component({...})
@Routes([
    {path: "/team/:id", component: TeamComponent},
    {path: "/*", component: DefaultComponent}
])
class AppRootComponent {
}
``` 

Point: **New route config no longer has a _name_ property.**

## `<router-outlet>` component
We can use `<router-outlet>` as well as old router.

```ts
@Component({
    ...
    template: `
    <!-- default outlet -->    
    <router-outlet></router-outlet>
    <!-- aux outlet -->    
    <router-outlet name="aux"></router-outlet>
    `,
    directives: [ROUTER_DIRECTIVES]
})
```

## `routerLink` directive
`routerLink` directive is still alive, but it takes an array of **url segments**.

```html
<a [routerLink]="['/team', 33, 'user', 'victor']">Victor Savkin</a>

<!--equivalent-->
<a [routerLink]="['/team/33/user/victor']">Victor Savkin</a>
```

If the link matches current route, `router-link-active` class is applied.

## `Router` class
New router has `Router` class, which is almost similar to old `Router`.

```ts
@Component({...})
class SomeComponent {
    constructor(private router: Router) {}
    
    doNavigationByUrl() {
        this.router.navigateByUrl("/some/path");
    }
    
    doNavigationByArray() {
        this.router.navigate(["/some/path"]);
    }
    
    listenUrlChangeEvent() {
        this.router.changes.subscribe(() => {
            // `changes` gives no arguments.
        });
    }
}
```

## Lifecycle methods
New router has only two lifecycle methods yet, `OnActivate` and `CanDeactivate`.

### `OnActivate`
New `OnActivate` interface has a `routerOnActivate` method.

```ts
@Component({...})
class SomeComponent implements OnActivate {
    routerOnActivate(
        curr: RouteSegment, 
        prev?: RouteSegment, 
        currTree?: RouteTree, 
        prevTree?: RouteTree
    ): void {
        ...
    }
}
```

Arguments of `routerOnActivate` are completely changed.

- **curr: RouteSegment**: Current (in activating) segment 
- **prev?: RouteSegment**: Previous segment 
- **currTree?: RouteTree;**: A segment tree composing current route
- **prevTree?: RouteTree;**: A previous segment tree

### `RouteSegment`: new API like `ComponentInstruction`
`RouteSegment` represents an information of the component transition.
It's similar to `ComponentInstruction`. 

| ComponentInstruction | RouteSegment |
|:-----------:|:------------:|
| `inst.componentInstruction` | `segment.component` |
| `inst.params` | `segment.parameters` |
| `inst.urlParams` | `segment.parameters` |
| `inst.params[key]` | `segment.getParam(key)` |
| `inst.urlPath` | `segment.stringifiedUrlSegments()` or `Location.path()` |
| - | `segment.outlet` |
| `inst.routeName` | - |
| `inst.routeData` | - |

We can use `getParam()` to get route parameters.

```
@Component({...})
class TeamComponent {
    id: string;
    
    routerOnActivate(curr: RouteSegment) {
        this.id = curr.getParam("id");
    }
}

@Component({...})
@Routes([
    {path: "/team/:id", component: TeamComponent}
])
class AppRootComponent {
}
```

### `RouteTree`: Tree structure of routes
`RouteSegment` has the information of _single_ route transition.
it means the segment doesn't have any parameters of parent routes.

```ts
@Component({...})
class UserComponent {
    
    routerOnActivate(curr: RouteSegment) {
        let name = curr.getParam("name"); // OK!
        let teamId = curr.getParam("id"); // NG!
    }
}

@Component({...})
@Routes([
    new Route({path: "/user/:name", component: UserComponent })
])
class TeamComponent {
}

@Component({...})
@Routes([
    {path: "/team/:id", component: TeamComponent}
])
class AppRootComponent {
}
```

In this case, `currTree` allows us to access **parent segment**.

```
@Component({...})
class UserComponent {
    
    routerOnActivate(curr: RouteSegment, prev, currTree: RouteTree) {
        let name = curr.getParam("name"); // OK!
        let teamSegment = currTree.parent(curr); // "parent of curr"
        let teamId = teamSegment.getParam("id"); // OK!
    }
}
```

Likewise, the tree has **child segment**

```
@Component({...})
class TeamComponent {    
    routerOnActivate(curr: RouteSegment, prev, currTree: RouteTree) {
        let id = curr.getParam("id");
        let userSegment = currTree.firstChild(curr);
        let currentUserName = userSegment.getParam("name");
    }
}
```

Point: New API; `RouteSegment` and `RouteTree`

### `CanDeactivate` 
`CanDeactivate` defines route lifecycle method `routerCanDeactivate` same as old router's one.

```ts
@Component({...})
class SomeComponent implements CanDeactivate {
  constructor(private logService: LogService) {}
  
  routerCanDeactivate(currTree: RouteTree, furuteTree: RouteTree): Promise<boolean> {
    return Promise.resolve(confirm('Are you sure you want to leave?'));
  }
}
```

## Summary

- `<router-outlet>` and `routerLink` are alive!
- `RouteConfig` turns into `Routes`
- Route definition no longer has own name
- New API: `RouteSegment` and `RouteTree`

New router is nice but you should be careful.

**Don't forget that's experimental!**
