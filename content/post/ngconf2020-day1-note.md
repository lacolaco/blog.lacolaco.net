---
title: "ng-conf 2020 Day1 Note"
date: 2020-04-02T06:33:37+09:00
tags: ["ngconf","ngconf2020","angular"]
foreign: true
---

<img width="2248" alt="image.png (3.0 MB)" src="https://img.esa.io/uploads/production/attachments/14362/2020/04/02/50720/aec1ce9a-d11f-4e26-a5ee-f7761f54d7a3.png">

# Day 1 Keynote

- OSS and communities
    - Developer Relations
- User stories
    - https://goo.gle/angular-survey-2020
- Who is Angular for ?
    - for Google
    - for the world
- Angualr is in Google Core OSS project
    - highly invested
    - 1500+ projects in 2019
    - 2000+ ing Spring 2020
- V9
    - 10k+ Public v9 Apps march 2020
    - Developer satisfaction growing
- ng-family

## v9
https://docs.google.com/presentation/d/1xbjoDUVt0DWB5YlHyIiLioAPswGqiCy9dYOvYIsjTAs/preview?slide=id.g26d86d3325_0_0

- v9.1 3/25
- Ivy
    - Big project
    - Smaller / Faster / Simpler
- Simpler 
    - Tree-shaking
    - Less generated code
        - More processing in runtime
    - Bundle size
        - vs v8  
            - small -30% / mid  -2% /  large -25-40% 
    - Faster Builds
        - separate dep compilation
            - ngcc compile per package on demand
        - No JSON conversion
            - No metadata.json
            - Use TypeScript only
        - 40% faster in angular.io
- Faster Tests
    - compile at first for all tests.
    - 40-50% faster
- Faster i18n
    - Post-process translations
        - Compile -> Bundele -> Minify -> *L10N*
    - 10x Faster
- Simpler
    - Debugging demo
        - ECAIHBCError
            - Jump into tempalte from stacktrace
            - Add debugger, Watching `ctx.title`
            - `ng.getComponent($0)`
        - `AppComponeny_Template` in stacktrace (User code)
    - `ng global`
        - Call CD in console
        - inspect components / directives
- Simpler build errors
    - compiler tells template location in an error
- Simpler type checking
    - `strictTemplates`
        - Inputs
        - $event
        - Local ref
        - Template context
- Simpler style merging
    - `[class]` with `[class.highlighted]`
- Simpler module def
    - no `entryComponents`
- Bugfixes over 100
- TypeScript 3.7/3.8
    - `optional chaning`
- Universal
    - `ng add` and `prerender`
- Component Test Harnesses
- YouTube Player component
- Google Maps component
- 10.0 coming next

# Http Interceptors: The Room Where It Happens
Ward Bell

https://1drv.ms/p/s!ArLFOyLcl1tjiMo0GbaNk4g8jUvs6g?e=9Koqvk

- Interceptors for 
    - inspect req
    - modify req
    - temnate req
    - inspect resp
    - modify resp
    - replace resp
- Logging
    - req: sync
    - resp: pipe
- Busy interceptor
    - show Busy at first req
        - increment count
    - hide Busy at last resp
        - `finalize()` operator is useful (like try-finally)
- Readonly interceptor
    - blocking other than GETs (some POSTs are needed...)
    - `return throwError(new Error(msg))`
- `handleErrors` operator
    - `catchError`
    - `handle401` 
        - check `WWW-Authenticate` (expiration)`
        - navigate to auth fail route
        - return `EMPTY` to complete the request
    - HttpBackend i the last interceptor

# How Ivy will improve your application architecture
Manfred Steyer
https://www.angulararchitects.io/konferenzen/how-ivy-will-improve-your-application-architecture

- component definition
- Template function
    - Tree shakable functions of Ivy
- New architectures enabled by Ivy
- Lazy components
    - using `import()`  and CFR + ViewContainerRef
    - Ivy component is self-describing
        - component definition
        - Ivy: Locality
        - Before Ivy: metadata within NgModules
    - Potential
        - Lazy loading
        - Partial Hydration
- HOC
    - create component via  factory function
    - call other component in template functions
    - `withRoute(DashboardPageComponent)` function
    - Potential
        - more dynamic
        - Framework extensions
- Standalone components (w/o NgModules)
    - `directiveDefs` array for composing other directives
    - `@Component.deps` proposal from Minko
    - Demo: `@ComponentDeps`
    - bootstrapping
        - `renderComponent()`
    - Potential
        - New Project structure
        - Slandalone components -> web components
- Conclusion
    - Lazy loading
    - Dynamic component/ HOC
    - Standalone components

# Deep dive into CLI Builders
Mike Hartington
https://mhartington.io/builders-deep-dive/

- What CLI builder is?
- `ng build`-> browser builder
    - `ng serve` -> dev-server builder
    - `ng test` -> karma builder
- Builder: `fn(option) => result`
- Architect: high-level settings
    - define commands
    - call builder
    - set options / configurations
- Make a builder
    - `builder.json`
        - define builders in the package
            - `implementation` / `schema` 
        - `export default createBuilder(fn: (options, context) => Promise)`
    - extends browser builder
        - `export default createBuilder(fn: (options, context) => Observable)`
        - `targetFromTargetString(options.browserTarget)`
        - `formJoin(from(context.getTargetOptions), from(context.getBuilderNameForTarget))
        - `from(context.validateOptions)` with schema
        - `concatMap(opts => extendBuilder(executeBrowserBuilder)(opts, context))`
        - `builder => return builder(option, context, { webpackConfiguration: config => config })`
            - modify `config`
- Good examples
- `@ionic/angular-toolkit`
- Replace node scripts
    - integrate different workflows

# Session #1 Q&A
Manfred Steyer Ward Bell Mike Hartington

- Ward
    - debouncing same GET requests

# A Philosophy for Designing Components with Composition
Jeremy Elbourn

https://g.co/ng/conf20-components

- MatSelect
    - 3 states
        - initial / selecting  / selected
- WAI-ARIA
    - `<div role="combobox">` 
    - complex roles
        - tabs
            - tab: same URL
            - anchor: with navigation
- Always START with your set of interaction patterns
    - Composite roles
- Style customization is inevitable
    - parameterized Sass Mixins
    - decompose styles: base / color / typography / animations
- CSS Variables
    - A solution
    - Not in IE11
    - Polyfills are not ideal
- Let use compose parts
    - separate behaviors
    - `<cool-table>` has all behavior in one component
- Design composable parts
    - mat-table / mat-paginator / mat-sort-header
        - don't know each other
        - depends on single data source
    - autocomplete = input + options
    - menu = trigger + options
    - datepicker = input + button + options
- Benefit
    - Single Reponsibility
    - Flexibility
    - Surfaces native elements
        - Use the platform `<button>` `<input>` 
- Cons
    - More verbose APIs
    - Overall larger API
- Conclusion
    - **Decompose and be deliberate with re-composition**
    - Customizing CSS is inevitable
    - Designs have trade-offs

# Angular Universal & Our New Prerenderer
Wagner Maciel

https://drive.google.com/open?id=1E2pFvwbwM4z0JPIfBik6co2d0XLQwIAW

- Universal Basic
    - SSR and Prerendering
    - Why? 
        - for Fisrt Contentful Paint
        - for fow low-power devices
        - for web clawlers
- New features
    - Live code reload
        - watching client/server bundles
    - Prerendering
        - generate static pages and save 
        - `routes` array
        - `routesFile` path

# Why Should You Care About RxJS Higher-order Mapping Operators?
Deborah Kurata 

https://docs.google.com/presentation/d/1cv9j9EdHrlN8GPMqZaqAXOmIDQ3Nh5l_vZmHETEIaq8/edit#slide=id.g4e4e10d8e0_2_72

- Higher-order mapping operator
- FIrst Order vs Higher Order 
    - First Order: map()
        - value to value
    - HO
        - value to Observable
- First Order
    - transform value
        - extracting
        - extending
        - converting
 - HO Mapping
     - OuterObservable -> InnerObservable
     - xxxMap()
     - automatically subscribe/unsub
 - mergeMap
     - To process items in parallel
     - order doesn't matter
 - concatMap
     - sequence version of mergeMap
 - switchMap
     - unsubscribe the prior incomplete inner observable

# The Phantom of the Template Error
Brian Love

https://drive.google.com/file/d/1ucFuwVkkDgcYnE1SiONiEN6CuvaJij26/view?usp=sharing

- 15%
    - Typechecking can detect bugs in JavaScript
- 3 mode
    - Basic / Full / Strict
- Reduce runtime errors

# Session #2 Q&A
Jeremy Elbourn Wagner Maciel Deborah Kurata Brian Love

- a11y tools
    - lighthouse
    - axe
        - unittest
- light/dark theme
    - A. separate CSS with `<link>`
        - small payload
    - B. media query
        - manage themed styles in the same file
- fixing Template errors
    - try strict at first and know problems
    - fix errors with basic in sprint

# Common Challenges facing Angular Enterprises
Stephen Fluin

- New pain points
- Use source-map-explorer
    - reduce bundle size
- Top 5 Challenges
    - Micro frontends
    - SSR
    - Monorepo / Core sharing
    - Varied Environments
    - Business Justifications
- Micro Frontends
    - "what do you mean?"
    - Enterprises want
        - Fast initial load
            - Answer
                - Angular updates
                - SSR
        - Seamless transitions
            - Answer
                - Angular's strength
        - Independent deploy
            - pushing into monorepo
            - problems
                - Guarantee API compatibility
                - Enforce Constraints
                - Intelligent build system
            - answers
                - Use Libraries
                - Future: Ivy & dynamic imports
    - SSR
        - Day 3 keynote
    - Monorepo
        - Coodination Problem
        - Tools
            - GitHub
            - Bazel
            - Pullapprove
        - The Viral Monorepo
            - One App + One Library
            - Two Apps + One Library
    - Varied Envs
        - Angular is good at orchestration
            - Angular Elements
            - Custom Elements
    - Business Justification
        - Security
        - One version
        - Performance
        - Recommended path
    - Component Usage Tracking
        - Invest in the most used components
        - Quantify value of shared code
    - http://bit.ly/stephen-survey

# Preload Strategies: Step in Time, Step in Time!
John Papa

https://slides.com/johnpapa/preload-strategies

- Eager/Lazy Loading
    - Eager: Users wait for everything to load
    - Lazy: Users wait when they navigate 
- Preloading: You control the user experience
    - Watching the network traffic
    - wait for Time to Interactive
- Preload strategies
    - None (default)
    - All (high network usage)
    - Custom
- Optin
- Ondemand
- NetworkAware

# Farewell Entry Components
Yvonne Allen
https://drive.google.com/file/d/1JO8SHNjvoIzSyV-sGE0E9AAQPVc1-TYc/view?usp=sharing

- `entryComponents` is no longer needed!

# Session #3 Q&A
John Papa Yvonne Allen Stephen Fluin

- TBD

