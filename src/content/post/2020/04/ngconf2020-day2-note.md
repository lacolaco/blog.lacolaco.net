---
title: 'ng-conf 2020 Day 2 Note'
slug: 'ngconf2020-day2-note'
icon: ''
created_time: '2020-04-03T00:00:00.000Z'
last_edited_time: '2023-12-30T10:09:00.000Z'
category: 'Tech'
tags:
  - 'Angular'
  - 'ng-conf'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/ng-conf-2020-Day-2-Note-35867cc9ff22410788d8cafe3e17f010'
features:
  katex: false
  mermaid: false
  tweet: false
---

# Domain-Driven Design and Angular

Manfred Steyer

[https://www.angulararchitects.io/konferenzen/domain-driven-design-and-angular/](https://www.angulararchitects.io/konferenzen/domain-driven-design-and-angular/) [https://github.com/manfredsteyer/monorepo_domains](https://github.com/manfredsteyer/monorepo_domains)

- How to create sustainable Angular architecture with ideas from DDD.
  - Not to create tiny app in quickly
- DDD
  - Strategic Design: Decomposing System -> Design <===
  - Tactical Design: Design Pattern + Practice -> Design
- Example: e-Procurement System
  - Subdomains
    - Catalog
    - Approval
    - Ordering
    - Specification
    - ![image](https://img.esa.io/uploads/production/attachments/14362/2020/04/03/50720/73779e17-4b01-4213-b9cf-9a4326b1bef9.png)
- Domains dependency
  - ![image](https://img.esa.io/uploads/production/attachments/14362/2020/04/03/50720/d3d39d4b-3046-46f5-b97b-d45e09cfd47e.png)
  - Protecting from breaking change
    - Shared Kernal: Bad
      - everyone be responsible === no one be responsible
    - API Approach
      - Each domain has its own API
  - Communicate over subdomains
- Monorepo
  - Each subdomain has its own Lib project
    - ![image](https://img.esa.io/uploads/production/attachments/14362/2020/04/03/50720/25173b6f-8f18-448e-9e71-6ca01773594a.png)
  - Protecting from framework version conflict
  - No burden with publishing libs (internal libs)
  - Share lib to other apps/companies via npm
- Domain has **features**
  - Feature = Smart Usecase Components
  - Composing Dumb UI Components
  - Access restriction via API
- Domain -> Application / Domain Model / Infrastructure
  - ![image](https://img.esa.io/uploads/production/attachments/14362/2020/04/03/50720/b4e3676a-0f9e-4c62-8c77-313b2114869f.png)
  - Domain models / Infrastructue don’t know about state management
- Layering options
  - All options restrict accesses between layers.
- Exported APIs are all public
- Catalog
  - `@e-proc/catalog/api` / `@e-proc/catalog/domain` / `@e-proc/catalog/feature-broesw-products`
  - Use tsconfig paths
    - Can change index entrypoint ts to customize app
      - for customer-A
  - Access to other domain
    - Only shared utils or APIs
    - Restricting with Lint
      - Project Type Rule
      - `nx.json` and `tslint.json`
      - Domain dependency rules + module type dependency rules
  - Affected modules
    - test / build only affected projects
  - Adding lib
    - ![image](https://img.esa.io/uploads/production/attachments/14362/2020/04/03/50720/162dd03c-3d81-4125-87c7-2b1aa4d1b86b.png)
- Facade and State Management
  - in Domain lib
  - behind Facades
    - ![image](https://img.esa.io/uploads/production/attachments/14362/2020/04/03/50720/cf98e123-ebb9-4aa3-9c6c-cad3046a40b5.png)
- Facade
  - Observable fields
    - start from BehaviorSubject
    - Store library on demand
    - ![image](https://img.esa.io/uploads/production/attachments/14362/2020/04/03/50720/e1d9bdc6-d1a8-409f-8765-b702c0ed2167.png)
- Automation
  - `ng g @angular-architects/ddd:{domain,feature}`

# Stronger Type-Checking in Templates with Ivy

Alex Rickabaugh

http://bit.ly/strictTemplates

- `strictTemplates`
  - similar to `strict` flag
- Outline
- in v8

  - Basic / fullTemplateTypeCheck
  - Basic
    - ![image](https://img.esa.io/uploads/production/attachments/14362/2020/04/03/50720/4027df59-45f6-4645-a140-f5ed866393b0.png)
  - `user.name.last` is ignored
  - Full
    - ![image](https://img.esa.io/uploads/production/attachments/14362/2020/04/03/50720/c03e1c94-58b2-4578-b1fa-a827e2cdf5c6.png)

- Ivy improvements

  - ngFor loop
    - v8
      - ![image](https://img.esa.io/uploads/production/attachments/14362/2020/04/03/50720/a327ed29-9c1d-4f22-88ca-216342b3206f.png)
      - `user` is typed as `any`
    - strict
      - ![image](https://img.esa.io/uploads/production/attachments/14362/2020/04/03/50720/156a6fd4-2eec-486f-89c8-c5289b600e61.png)
  - Inputs

    - v8

      - ![image](https://img.esa.io/uploads/production/attachments/14362/2020/04/03/50720/06257608-1520-400c-96fd-aad509ac0cbd.png)

        - `[user]` is not type-checked
        - Problem with non-null input with `| async`

    - strict
      - ![image](https://img.esa.io/uploads/production/attachments/14362/2020/04/03/50720/5a67a308-c26e-483f-9bf7-a5c89e7ab948.png)

- $event
  - ![image](https://img.esa.io/uploads/production/attachments/14362/2020/04/03/50720/2c5fb689-0d96-4993-8aad-7a9ef44450e6.png)
- Safe navigation
  - v8: runtime error
    - Ignored after `?.`
    - ![image](https://img.esa.io/uploads/production/attachments/14362/2020/04/03/50720/8ce42bf7-3856-443b-bd04-64d7c86a542b.png)
  - strict
    - check correctly
    - ![image](https://img.esa.io/uploads/production/attachments/14362/2020/04/03/50720/400e47d6-0702-4052-95fc-f3353b11fe8f.png)
- Migration
  - Try strict and see the errors
  - Fix these!
  - Enable strict mode
- `strictInputTypes: false`
  - for compatible with libraries with wrong types
    - ![image](https://img.esa.io/uploads/production/attachments/14362/2020/04/03/50720/43a20712-334d-4441-b119-340cd2166cc5.png)
- `strictAttributeTypes: false`
  - with custom-elements without types
- Other flagls
  - `strictSafeNavigationTypes: false`
  - `strictOutputEventTypes: false`
  - `strictDomEventTypes: false`
- How it works
- convert Template -> TypeScript
  - Generate type-checking Code
  - Creating check function -> validate with context
  - check with `if (ngTemplateContextGuard())`
  - type check compiled template function

# Facing the music when millions of daily users hit Delta.com after every release

Vishal Kumar

https://drive.google.com/open?id=1bbRBey3Wb4RvCbcGrNr3jFwcVFkT6eU8

- Delta.com
- Build it scalable
  - Physically Separate apps
    - easy to maintenance and ownership
    - Micro-frontend architecture
  - Isolated mini apps
    - iframes
    - custom elements
    - library components
  - Load balancing
- Effective content management
  - headless CMS
    - Business/Marketing control
    - No deploy
    - full control presentation
    - multiple UIs
    - performance
  - CDN
- Error tracking
  - Testing automation
    - Cross browsers
    - Load testing
  - Bug tracking
    - Client side error logging
  - Application Monitoring
    - Alerts on error
    - Alerts on response time
    - Alerts on behavior anomaly
- BFF layer
  - Integrate
  - Process business logic and validate
  - Avoid using client CPU
  - Minimize data
- Feature Toggle
  - safe launch
  - A/B Testing
  - Usage tracking
  - Quick improvement

# Getting through the awkwardness of networking

Wesley Faulkner

https://drive.google.com/file/d/1su4s9WFHnRkSi4CeCYTlN5PPVSOkk6Wi/view?usp=sharing

- People difference and networking
- Basics
  - Eye contact
  - Listening
  - Smile
  - Follow on journey

# Session #4 Q&A

Manfred Steyer Alex Rickabaugh Vishal Kumar Wesley Faulkner

# From Google Analytics to Universal deploy schematics!

James Daniels

https://drive.google.com/file/d/1NqsdOoeHdqAjR0va6dM2qxMhZ59wphUb/view?usp=sharing

- Firebase for Web
  - Google Analytics
- Angularfire
  - v6.0 stable!
  - Analytics
    - Integrated with Angular Router
  - Performance Monitor
    - network performance
    - `trace` pipe for async task
  - RemoteConfig
  - Hosting + Functions
    - Angular Univesal app
    - `ng deploy --preview`
  - Lightweight lazy modules
    - wrapper for Firebase JS SDK
    - automatically improve performance

# Revisiting a Reactive Router with Ivy

Brandon Roberts

https://drive.google.com/file/d/12ybYHAl4SYN3y74MDuwzhfOqcsi7ko_e/view?usp=sharing

https://github.com/brandonroberts/ngconf2020-reactive-router

- AngularJS router
  - `ngRoute`
  - `<ng-view>`
  - ui-router
- Angular 2 (Beta)
  - Promises
  - Tree of routers
- `@ngrx/router` by Victor Savkin
  - to Angular Router
- Ivy enables the dream
- Observable In -> OUt
  - Stream of URL change
  - Stearms of informations
- What do we need?
  - History Web API
  - Router (global data)
    - Stream of URL changes
    - URL Parser
    - Query Params/Hash
  - Register routes
  - Matcher
  - Renderer
- History API
  - URL Change / Push state
  - Angular `Location` Service
- URL Parser
  - `URL` Web API
    - Path
    - QueryParams
    - Hash
  - `new URL(location)`
- `<ngrx-router>`
  - `<ngrx-route [path] [component]>`
- Lazy Loading
  - `<ngrx-route [path] [loadComponent]="() => import()">`
- `RouterModule.forRoot` -> `provideRouter()`
- http://conf.ngrx.io

# A Journey into the World Of Machine Learning with TensorFlow.js

Aaron Ma

[http://bit.ly/ngConf20](http://bit.ly/ngConf20)

- 11 yo tensorflow contributor!
- First AI-powered Doodle
  - In-Browser ML
    - No installs
    - Interactive
    - Secure
- Angular + ML-powered Web App
- Traditional vs ML
  - Focus on code vs data
- Tensorflow.js
  - Tensor: Array
  - Multiple Backends
    - WASM
    - WebGPU coming soon
  - extensions
    - ml5.js
- Demo: http://aaronma.me/ngconf-2020/
  - https://github.com/aaronhma/ngconf-2020

# Session #5 Q&A

James Daniels Brandon Roberts Aaron Ma

# Bazel + Angular Today

Jorge Cano

https://docs.google.com/presentation/d/1zZ_D8IW6gSVaYHuKmLbcgfzqcaEFBdMo9mNS3tk1ylY/edit?usp=sharing

- Bazel Starter kit
- Bazel today
  - v1.0
- Google monorepo is built with Blaze
- RBE
  - More Reproducible
  - Scalable
  - Builds up to 10x faster
- Prior arts
  - `ng build` -> builder -> `build-angular:browser`
    - Custom Builders
  - Nx
    - Scaling problem
- Bazel v1.5
  - working on v2.0 branch

# Debugging Like a Boss with Angular 9

Anthony Humes

https://slides.com/anthonyhumes/debugging-angular-9#/

- Demo `ng` global APIs

# INTO THE UNKNOWN

Craig Spence

https://slides.com/craigspence/into-the-unknown

- Introduce `unknown` type and `never` type
- Conditional Types

# A Whole New Way to Build Ivy Apps ⚡️

Eric Simons

- StackBlitz
  - 2020
    - Themes
    - Auto-import
    - Zen mode
- Angular 9.1.0 + Enable Ivy
- on-prem enterprise support
- Desktop PWA

# Session #6 Q&A

Jorge Cano Anthony Humes Craig Spence Eric Simons
