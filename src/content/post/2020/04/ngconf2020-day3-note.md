---
title: 'ng-conf 2020 Day3 Note'
slug: 'ngconf2020-day3-note'
icon: ''
created_time: '2020-04-04T00:00:00.000Z'
last_edited_time: '2023-12-30T10:09:00.000Z'
category: 'Tech'
tags:
  - 'Angular'
  - 'ng-conf'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/ng-conf-2020-Day3-Note-696576eb42b44c2683442a1ef14f2515'
features:
  katex: false
  mermaid: false
  tweet: false
---

![image](https://img.esa.io/uploads/production/attachments/14362/2020/04/02/50720/aec1ce9a-d11f-4e26-a5ee-f7761f54d7a3.png)

https://docs.google.com/spreadsheets/d/115lOMIdmmkPviI3b2P6Yzqx6c1KKb-yrJkpClo5EllI/edit#gid=0

# Day #3 Keynote

Igor Minar Minko Gechev

http://g.co/ng/conf20-keynote2

## Balancing DX & UX

- Web platform
  - Uniquitous
  - Accessible
  - Malleable
  - Evolving, yet stable
- Eosystem
  - built with many tools / libs / patterns
- No one likes waiting
- DX vs UX -> UX and DX
- Angular’s goal
- Off to a good start with `ng new`
  - providing good default
  - fast iteration cycle
  - production optimization
- Ivy
  - UX improvement: bundle size down
  - DX improvements: build/test
- Analytics performance
  - Use source-map-explorer (strongly recommended)
    - instead of webpack-bundle-analyzer (tree-shaking issue)
  - issues
    - big CSS
    - animations dependency
    - Zone.js
  - Perf tools
    - SME
    - LightHouse / web.dev/measure
    - webpagetest.org/easy
- Use 3rd Party: Responsibility
  - Don’t use CJS/AMD libs
- Lazy load (almost) everything
  - `import()`
  - `<img loading="lazy">`
- Stay up to date
  - `ng update`
  - Most developers uses the latest
- Angular team exploring
  - Better (stricter) defaults
  - Dynamic component lazy loading (1st class support)
  - warning/errors on common perf issues
  - Under the hood cleanup
    - improvements deferred for Ivy
- Angular balances UX and DX needs at scale!

## The state of Angular deployment SSR Prerendering

- Largest Contentful Paint (LCP)
  - Since CGI: execute programs
  - Each interaction needs page reload => Ajax
- TTI (Time to Interactive): request scripts
  - Since Ajax
- Backbone and AngularJS
  - Rich UX
  - Users waiting for LCP/TTI
- Sometimes bundles cannot be smaller
  - => Server side rendering
    - CGI like approach
    - Faster LCP
  - Angular Universal project started
- Angular Universal in crunchbase
  - Using Angular universal in production
  - Some pages took 20 secs to load
  - SEO problem
- Challanges with Universal
  - Change-refresh time
  - Deployment
- v9 SSR
  - `serve-ssr`
  - Deployment
    - automatically `@angular/fire` deployment with Universal (canary)
      - using Firebase Function
- Prerendering
  - Rendering at build time instead of server runtime
  - some site: < 2s for 800 pages
- JAMStack
  - Universal prerendering
  - Scully

mgv.io

# The Control Container and I

Jennifer Wadella

https://tehfedaykin.github.io/ControlContainer

- https://nookpos.web.app/
- creating reactive form
  - how to change to multi-steps?
- form steps to routes
  - `<form [formGroup]><router-outlet></form>`
  - Error: `formControlName must be used with parent formGroup directive`
- `ControlContainer` service
- Inject ControlContainer via viewProviders in child step component
- Inject via providers in parent component
  - how to get formControl instance?
- Inject via constructor in children
  - it needs `formGroup` in each child

# The Role of Effects in NgRx Authentication

Sam Julien

http://samj.im/ngconf-hardwired https://speakerdeck.com/samjulien/the-role-of-effects-in-ngrx-authentication

- Effects
  - Decide when to call services
  - Communicate with APIs
  - Handle control flow logic
    - Function as task runner
    - Brain
- Common Struggles
  - Actiions that only trigger effects
    - as a task runner
  - No-dispatching effects
  - Complex effect
- Log in Flow
  - Pure Angular
    - AuthService – Components
  - NgRx way
    - AuthService behind effects
  - which parts is state change?
    - user and token
    - others are side-effects
- `login` action: start login
  - only trigger Effects + no dispatching
  - Everything until changing state is side-effect
- `handleRedirect` action
  - complex effect thenario
- Find the hidden side-effects
  - One Effect handle one side-effect

# Stepping Up: Observable Services to Observable Store

Dan Wahlin

- Store: Single Source of Truth
- Observable Store by codewithdan

# Session #7 Q&A

Jennifer Wadella Sam Julien Dan Wahlin

# The best 20 minute Angular & Firebase video you’ll ever see

David East

- angular + firebase full demonstration

# State of RxJS

Ben Lesh

https://docs.google.com/presentation/d/1pqbojTcQGUiQ6b-aA7bGl2rmboChsZQnR-LZ1cDpkT4/edit?usp=sharing

- RxJS goal
  - utility library
- community growing
  - 18M downloads / week
- v7 beta@next
  - Improved Stability
    - Partnered with Google’s g3 repo
  - better TypeScript support
    - N-argument inference
  - New Functionality
  - 7.1 and beyond
- `toPromise()` is deperecated
  - `lastValueFrom()` / `firstValueFrom()`
- `animationFrames()`
  - scheduler deprecated
- AsyncIterable support (generator)
  - `rxjs-for-await`
  - IxJS
- `retry` operator
  - `resetOnSuccess` option
- `scheduled()` and `obserbeOn()`
  - deprecate scheduler
- `deperecate`subscribe(next, error, complete)``next`only or observer object - same on`tap`
- Reducing payload
  - scheduler code was not tree-shaked
- `TimestampProvider`: Date or `performance` or …
- 7.1
  - ESLint transformations to migration
  - New feature `fromFetch` etc.
  - Prepare for v8
    - Removing deprecations
    - 40% smaller
    - Latest JS/TS

# The State of NgRx

Mike Ryan

- State management
  - Store / Router / DB
    - Router = Angular Router
    - NgRx DB doesn’t exist
- Store
  - Growing
  - 300+ Google Apps
  - 100+ Contributors
- State / View / Data
- NgRx State
  - store / effects / entity / …
  - last year
    - `createAction`, `createReducer`, `createEffect`
    - runtime checks: immutability / serializability / change detection
- NgRx Data
  - `@ngrx/data`
  - NgRx State is not scalable for data-driven apps with 50+ entities
  - NgRx Data: Abstract How to fetch data
    - Independent on State
- NgRx View
  - `@ngrx/component` / `@ngrx/router`
  - Rethink how change detection works for Angular apps
    - Zone.js is the default
  - Observable as a scheduler for CD
  - AsyncPipe -> NgrxPush
    - Push Pipe will schedule CD on value push
  - NgIf -> NgrxLet
    - Unwrap Observable and run CD
  - Future
    - Manage component local state

# Session #8 Q&A

David East Ben Lesh Mike Ryan

# Resilient Angular Testing – Jaw dropping magic tricks by the magnificent Shairezniko

Shai Reznik

http://hirez.link/ngconf-2020

- TestAngular.com
- 3rd party libs
  - Adapter pattern
    - abstract 3rd party lib
  - External integrtion test
    - Don’t mock external library
- verbose spec
  - `createSpyFromClass()`
  - Wrap HttpClient for spying
- Don’t mock what you don’t own

# Angular Language Service: What’s New

Keen Yee Liau

https://drive.google.com/open?id=1dvz9zo1d-i1B1XpkcPjq3QCN1XNtVLE-

- Main features
  - Tooltip (Quick info)
  - Jump to definition
  - Complettion
  - Diagnostic
  - Syntax highlight
- `AppModule.AppComponent`
  - declarations
- LSP (Language Server Protocol
  - VSCode
  - Eclipse
  - Emacs
  - Vim
- Future
  - integrate with Ivy compiler
    - consistent diagnostics
    - strictTemplates
  - refactoring

# Non-Server Side Story: When JAMstack met Angular

Divya Tagtachian Tara Z. Manicsic

- JAMstack
  - Cycle: Build -> Generate -> Deploy
- Angular JAMstack
  - using netlify Scully
  - `ng add netlify-schematics`

# The Makings of Scully

Sander Elias

- SSG
  - speed up your app
  - SEO
  - Less to no deps on API servers
  - Easy to host
  - Can make JS optional
- Add Scully
  - `ng add`
- Community Plugin system

# Session #9 Q&A

Shai Reznik Keen Yee Liau Divya Tagtachian Tara Z. Manicsic Sander Elias
