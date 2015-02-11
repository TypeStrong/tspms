# TypeScript ProjectManager Service 

> An abstraction on top [TypeScript](http://www.typescriptlang.org/) language service, that let you consume it in the context of a project.

## Installation

To use this module install it through npm: 
```
npm install tspms
```

## Purpose 

This module provides a simple abstraction on top of the [TypeScript language service](https://github.com/Microsoft/TypeScript/wiki/Using-the-Language-Service-API)
that will allow the user to manage multiple projects and access to the language service features in the context of those projects.

## Requirement

While this module can only be consumed through a [commonjs module system](http://wiki.commonjs.org/wiki/Modules/1.1) like [Node.js](http://nodejs.org/), 
it has been developed to be able to run in any evironment.  
To use this module in the browser or in a [Web Worker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API), 
use a commonjs module bundler like [browserify](http://browserify.org/) or [webpack](http://webpack.github.io/).  
This module expects an implementation for some Node.js core modules like `path`, `crypto` etc...  
It has been tested against the [browserify version](https://github.com/substack/node-browserify#compatibility) of those modules.

## Usage

This module consumes interfaces that abstract the file system and the editor. You need to provide an implemention of those interfaces to bootstrap the module.  
Once initialized it manages typescript projects and let you accesss to an async layer on top of the languageService api that will be executed in the context of those projects.

You can find more informations in the [Usage section](./doc/Usage.md) of the Documentation.  
Alternatively you can directly look at the [API Documentation](./doc/API.md)

## TypeScript Compatibility

This module allows to provide a custom compiler, the language service api however must be compatible with the one from TypeScript version 1.4.

## Definition file

You can find a definition [`index.d.ts`](./index.d.ts) file in this repository, it assumes that the [typescript definition file](https://github.com/Microsoft/TypeScript/blob/v1.4/bin/typescript.d.ts) is in the compilation context.
