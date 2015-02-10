'use strict';

import path                    = require('path');
import minimatch               = require('minimatch');
import crypto                  = require('crypto');
import project                 = require('./project');
import promise                 = require('./promise');
import TypeScriptProjectConfig = project.TypeScriptProjectConfig;


type PromiseQueueItem = promise.Promise<any> | (() => promise.Promise<any>) | (() => any);

export interface PromiseQueue {
    then<T>(callback: () => promise.Promise<T>): promise.Promise<T>;
    then<T>(callback: () => T): promise.Promise<T>;
    
    
    reset<T>(item: promise.Promise<T>): promise.Promise<T>;
}

interface Deferred {
    resolve(t: any): void;
    reject(reaison: any): void;
}

export function createPromiseQueue(): PromiseQueue {
    
    var idHelper = 1;
    var items: number[] = [];
    var itemsMap: {[index: number]: PromiseQueueItem} = {};
    var itemsDeferred: {[index: number]: Deferred } = {};
    
    var ready: boolean = true;
    var initialized: boolean = false;
    
    function drainQueue():void {
        if (ready && initialized) {
            var id = items.shift();
            if (!id) {
                return;
            }
            
            ready = false;
            var item = itemsMap[id];
            var deferred = itemsDeferred[id];
            
            delete itemsMap[id];
            delete itemsDeferred[id];
            
            if (typeof item === 'function') {
                try {
                    item = (<any>item)();
                } catch(e) {
                    deferred.reject(e)
                    ready = true;
                    drainQueue();
                }
            }
            
            promise.Promise.resolve(item)
                .then(result => {
                    deferred.resolve(result);
                    ready = true;
                    drainQueue();
                }, error => {
                    deferred.reject(error)
                    ready = true;
                    drainQueue();
                });
        }
    }
   
    function reset<T>(task: promise.Promise<T>) {
        var id = idHelper++;
        initialized = true;
        items.unshift(id);
        itemsMap[id] = task;
        var result = new promise.Promise<T>(function (resolve: any, reject: any) {
            itemsDeferred[id] = { resolve, reject };
        });
        drainQueue();
        return result;
    } 
    
    function then<T>(callback: (() => promise.Promise<T>) |  (() => T)) {
        var id = idHelper++;
        
        items.push(id);
        itemsMap[id] = callback;
        var result = new promise.Promise<T>(function (resolve: any, reject: any) {
            itemsDeferred[id] = { resolve, reject };
        });
        
        drainQueue();
        return result;
    }
    
    return { then, reset };
} 




export function mapValues<T>(map: { [index: string]: T }): T[] {
    return Object.keys(map).reduce( (result: T[], key: string) => {
        result.push(map[key]);
        return result;
    }, []);
} 

/**
 * assign all properties of a list of object to an object
 * @param target the object that will receive properties
 * @param items items which properties will be assigned to a target
 */
export function assign(target: any, ...items: any[]): any {
    return items.reduce(function (target: any, source: any) {
        return Object.keys(source).reduce((target: any, key: string) => {
            target[key] = source[key];
            return target;
        }, target);
    }, target);
}

/**
 * clone an object (shallow)
 * @param target the object to clone
 */
export function clone<T>(target: T): T {
    return assign(Array.isArray(target) ? [] : {}, target);
}





/**
 * browserify path.resolve is buggy on windows
 * @param from an ABSOLUTE path
 * @param to an relative path
 */
export function pathResolve(from: string, to: string): string {
    var result = path.resolve(from, to);
    var index = result.indexOf(from[0]);
    return result.slice(index);
}



/**
 * C# like events and delegates for typed events
 * dispatching
 */
export interface ISignal<T> {
    /**
     * Subscribes a listener for the signal.
     * 
     * @params listener the callback to call when events are dispatched
     * @params priority an optional priority for this signal
     */
    add(listener: (parameter: T) => any, priority?: number): void;
    
    /**
     * unsubscribe a listener for the signal
     * 
     * @params listener the previously subscribed listener
     */
    remove(listener: (parameter: T) => any): void;
    
    /**
     * dispatch an event
     * 
     * @params parameter the parameter attached to the event dispatching
     */
    dispatch(parameter?: T): boolean;
    
    /**
     * Remove all listener from the signal
     */
    clear(): void;
    
    /**
     * @return true if the listener has been subsribed to this signal
     */
    hasListeners(): boolean;
}


export class Signal<T> implements ISignal<T> {
    
    /**
     * list of listeners that have been suscribed to this signal
     */
    private listeners: { (parameter: T): any }[] = [];
    
    /**
     * Priorities corresponding to the listeners 
     */
    private priorities: number[] = [];
    
    /**
     * Subscribes a listener for the signal.
     * 
     * @params listener the callback to call when events are dispatched
     * @params priority an optional priority for this signal
     */
    add(listener: (parameter: T) => any, priority = 0): void {
        var index = this.listeners.indexOf(listener);
        if (index !== -1) {
            this.priorities[index] = priority;
            return;
        }
        for (var i = 0, l = this.priorities.length; i < l; i++) {
            if (this.priorities[i] < priority) {
                this.priorities.splice(i, 0, priority);
                this.listeners.splice(i, 0, listener);
                return;
            }
        }
        this.priorities.push(priority);
        this.listeners.push(listener);
    }
    
    /**
     * unsubscribe a listener for the signal
     * 
     * @params listener the previously subscribed listener
     */
    remove(listener: (parameter: T) => any): void {
        var index = this.listeners.indexOf(listener);
        if (index >= 0) {
            this.priorities.splice(index, 1);
            this.listeners.splice(index, 1);
        }
    }
    
    /**
     * dispatch an event
     * 
     * @params parameter the parameter attached to the event dispatching
     */
    dispatch(parameter?: T): boolean {
        var hasBeenCanceled = this.listeners.every((listener: (parameter: T) => any) =>  {
            var result = listener(parameter);
            return result !== false;
        });
        
        return hasBeenCanceled;
    }
    
    /**
     * Remove all listener from the signal
     */
    clear(): void {
        this.listeners = [];
        this.priorities = [];
    }
    
    /**
     * @return true if the listener has been subsribed to this signal
     */
    hasListeners(): boolean {
        return this.listeners.length > 0;
    }
}

export function binarySearch(array: number[], value: number): number {
    var low = 0;
    var high = array.length - 1;

    while (low <= high) {
        var middle = low + ((high - low) >> 1);
        var midValue = array[middle];

        if (midValue === value) {
            return middle;
        }
        else if (midValue > value) {
            high = middle - 1;
        }
        else {
            low = middle + 1;
        }
    }

    return ~low;
}


function isAbsolute(fileName: string): boolean {
    if (fileName.charAt(0) === "/" || fileName === "") {
        return true;    
    }
    // pull off the device/UNC bit from a windows path.
    // from node's lib/path.js
    var splitDeviceRe =
      /^([a-zA-Z]:|[\\\/]{2}[^\\\/]+[\\\/]+[^\\\/]+)?([\\\/])?([\s\S]*?)$/
    var result = splitDeviceRe.exec(fileName)
    var device = result[1] || ''
    var isUnc = device && device.charAt(1) !== ':'
    var isAbsolute = !!result[2] || isUnc // UNC paths are always absolute

    return isAbsolute
}


export function match(baseDir: string, fileName: string, patterns: string[] | string, options?: minimatch.Options): boolean {
    
    var arrayPatterns = typeof patterns === 'string' ? [patterns] : patterns;
    fileName = path.resolve(baseDir, fileName);
    
    var result: boolean = false;
    for (var i = 0; i < arrayPatterns.length; i++) {
        var pattern = arrayPatterns[i];
        var exclusion = pattern.indexOf('!') === 0;
        if (exclusion) { 
            pattern = pattern.slice(1); 
        }
        
        if (!isAbsolute(pattern)) {
            pattern = path.resolve(baseDir, pattern);
        }
        
        if (minimatch(fileName, pattern, options)) {
            if (exclusion) {
                return false;
            } else {
                result = true;
            }
        }
    }
    return result;
}

/**
 * get a hash of the typescript compiler
 */
export function getHash(content: string): string {
    var shasum = crypto.createHash('sha1');
    shasum.update(content, 'utf8');
    return shasum.digest('hex').toString();
}


export interface Map<T> {
    [key: string]: T;
}

export type Set = Map<boolean>;

export function arrayToSet(arr: string[]): Set {
    return arr.reduce((result: Set, key: string) => {
        result[key] = true;
        return result;
    }, Object.create(null));
}

