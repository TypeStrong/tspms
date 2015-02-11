# Usage

## Injecting Promise and console

### Promise Injection

While the module is bundled with a minimal promise implementation, it is higly encouraged to inject your own promise library (like [bluebird](https://github.com/petkaantonov/bluebird)).
To do so use the [`injectPromiseLibrary`](./API.md#injectPromiseLibrary) function of tspms: 

```
var tspms = require('tspms');
var Promise = require('promise');
tspms.injectpromiselibrary(Promise);
```

> The promise library Injected must be compatible with [es6 promises](http://www.html5rocks.com/fr/tutorials/es6/promises/).


### Logger injection

This module has been developed with web worker in mind, we cannot assume that `console` will be available, if you want to enable logging, you need to inject logging functions.
Use the [`injectLogger`](./API.md#injectlogger).

```
var tspms = require('tspms');
var Promise = require('promise');
tspms.injectLogger(
    (message) => console.log(message),
    (message) => console.warn(message),
    (message) => console.error(message)
)
```

> The three functions injected will be used for 3 differents levels of logging : info, warning, error. If you want to disable a log level just inject a noop function for the corresponding level.

## Bootstraping the service

## ISignal

Events in the module are generally dispatched/consumed through the [`ISignal`](https://github.com/TypeStrong/typescript-project-services/blob/master/doc/API.md#isignal) interface, 
this interface describe a typed event system close to the C# one.  
You can find a reference implementation of this interface in the [`utils.ts`](https://github.com/TypeStrong/typescript-project-services/blob/master/src/main/utils.ts#L171-L250) file.

## The IFileSystem interface

The module consumes filesystem information through the IFileSystem [IFileSystem](./API.md#ifilesystem) interface.  
This interface provides to the module informations like the current directory, the list of all typescript files under this directory, 
file change events over time, and a way to read a file content.

## The IWorkingSet interface

The module retrieves editor related informations through the IWorkingSet [IWorkingSet](./API.md#iworkingset) interface. 
This interface provides to the module informations like the set of files open in the editor, and file editions events.

## Init

To initialize the module simply call the [`init`](./API.md#init) function of the project with a valid [`ProjectManagerConfig`](./API.md#projectmanagerconfig) instance.
Once the module has been initialized you can consume the language service api.

```
var tspms = require('tspms');
var ts = require('typescript');
var fileSystem: tspms.IFileSystem = ...;
var workingSet: tspms.IWorkingSet = ...;

tspms.init({
    defaultLibFileName: 'path/to/typescript/bin/lib.d.ts',
    fileSystem,
    workingSet,
    projectConfigs: {
      mainProject: {
        compilerOptions: {
          target: ts.ScriptTarget.ES5,
          ....
        }
        sources: ['src/**.ts']
      },
      ...
    }
});

tspms.getCompletionAtPosition(absoluteFileName, 123).then(completionsResults => {
    ....
})
```


## Dispose
To reset the module state simply call the [`dispose`](./API.md#dispose) function of the module.


## LanguageService Features

see the [API Documentation](./API.md)