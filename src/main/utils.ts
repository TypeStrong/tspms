'use strict';

import path = require('path');
import minimatch = require('minimatch');
import crypto = require('crypto');
import project = require('./project');
import promise = require('./promise');

import TypeScriptProjectConfig = project.TypeScriptProjectConfig;

//--------------------------------------------------------------------------
//
//  PromiseQueue
//
//--------------------------------------------------------------------------

/**
 * Type of items in the queue.
 */
type PromiseQueueItem = promise.Promise<any> | (() => promise.Promise<any>) | (() => any);

/**
 * Deferred
 */
type Deferred = {
    resolve(t: any): void;
    reject(reaison: any): void;
}

/**
 * A PromiseQueue, used to insure that async task are executed sequentially.
 */
export interface PromiseQueue {
    /**
     * Add a task to the Queue, return a promise that will be resolved 
     * with the result of that task 
     * 
     * @param task the task to execute.
     */
    then<T>(task: () => promise.Promise<T> | T): promise.Promise<T>;
    
    /**
     * Reset/init the promise queue, once this methid is called all task in the 
     * promise queue will be executed sequentially once the initiam promise is resolved.
     * 
     * @param init the inial async task of the queue.
     */
    reset<T>(init: promise.Promise<T>): promise.Promise<T>;
}

/**
 * PromiseQueue factory.
 */
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

//--------------------------------------------------------------------------
//
//  Signal
//
//--------------------------------------------------------------------------

/**
 * C# like events and delegates for typed events dispatching.
 */
export interface ISignal<T> {
    /**
     * Subscribes a listener for the signal.
     * 
     * @params listener the callback to call when events are dispatched.
     * @params priority an optional priority for this listerner
     */
    add(listener: (parameter: T) => any, priority?: number): void;
    
    /**
     * unsubscribe a listener for the signal
     * 
     * @params listener the previously subscribed listener
     */
    remove(listener: (parameter: T) => any): void;
    
    /**
     * Dispatch an event.
     * 
     * @params parameter the parameter attached to the event dispatched.
     */
    dispatch(parameter?: T): boolean;
    
    /**
     * Remove all listener from the signal.
     */
    clear(): void;
    
    /**
     * Returns true if listener has been subsribed to this signal.
     */
    hasListeners(): boolean;
}

/**
 * Reference ISignal implementation.
 */
export class Signal<T> implements ISignal<T> {
    
    /**
     * list of listeners that have been suscribed to this signal.
     */
    private listeners: { (parameter: T): any }[] = [];
    
    /**
     * Priorities corresponding to the listeners.
     */
    private priorities: number[] = [];
    
    /**
     * Subscribes a listener for the signal.
     * 
     * @params listener the callback to call when events are dispatched.
     * @params priority an optional priority for this listener.
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
     * Unsubscribe a listener for the signal.
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
     * Dispatches an event.
     * 
     * @params parameter the parameter attached to the event dispatched.
     */
    dispatch(parameter?: T): boolean {
        var hasBeenCanceled = this.listeners.every((listener: (parameter: T) => any) =>  {
            var result = listener(parameter);
            return result !== false;
        });
        
        return hasBeenCanceled;
    }
    
    /**
     * Removes all listener from the signal.
     */
    clear(): void {
        this.listeners = [];
        this.priorities = [];
    }
    
    /**
     * Returns true if the listener has been subsribed to this signal.
     */
    hasListeners(): boolean {
        return this.listeners.length > 0;
    }
}

//--------------------------------------------------------------------------
//
//  Object/Array utils
//
//--------------------------------------------------------------------------

/**
 * Assign all properties of a list of object to an object.
 * 
 * @param target the object that will receive properties.
 * @param items objects which properties will be assigned to a target.
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
 * Clone an object (shallow).
 * 
 * @param target the object to clone
 */
export function clone<T>(target: T): T {
    return assign(Array.isArray(target) ? [] : {}, target);
}

/**
 * A recursive array
 */
export interface RecursiveArray<T> extends Array<T | RecursiveArray<T>> { }

/**
 * flatten a recursive array
 * 
 * @param array the array to flatten
 */
export function flatten<T>(array: RecursiveArray<T>): Array<T> {
    var result: T[] = [];
    for (var i = 0, length = array.length; i < length; i++) {
        var value: any = array[i];
        if (Array.isArray(value)) {
            result.push.apply(result, flatten(value));
        } else  {
            result.push(value)
        }
    }
    return result;
};
//--------------------------------------------------------------------------
//
//  Path utils
//
//--------------------------------------------------------------------------

/**
 * Browserify path.resolve is buggy on windows.
 * 
 * @param from an absolute path.
 * @param to an relative path.
 */
export function pathResolve(from: string, to: string): string {
    var result = path.resolve(from, to);
    var index = result.indexOf(from[0]);
    return result.slice(index);
}

/**
 * Returns true if the fileName is absolute.
 * 
 * @param fileName the file name.
 */
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

/**
 * Matching utils for path based on minimatch.
 * 
 * @param baseDir the absolute directory path where the match happens.
 * @param fileName the absolute file name.
 * @param patterns the patterns to match the file against.
 * @param options minimatch options used for the match.
 */
export function match(baseDir: string, fileName: string, patterns: string[] | string, options?: minimatch.Options): boolean {
    var arrayPatterns = typeof patterns === 'string' ? [patterns] : patterns;
    
    var result: boolean = false;
    for (var i = 0; i < arrayPatterns.length; i++) {
        var pattern = arrayPatterns[i];
        var exclusion = pattern.indexOf('!') === 0;
        if (exclusion) { 
            pattern = pattern.slice(1); 
        }
        
        if (!isAbsolute(pattern)) {
            pattern = pathResolve(baseDir, pattern);
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
 * Get a sha1 hash of a string.
 * 
 * @param value the string to hash.
 */
export function getHash(value: string): string {
    var shasum = crypto.createHash('sha1');
    shasum.update(value, 'utf8');
    return shasum.digest('hex').toString();
}

//--------------------------------------------------------------------------
//
//  Map and Set
//
//--------------------------------------------------------------------------

/**
 * Represent a Map, key are string.
 */
export interface Map<T> {
    [key: string]: T;
}

/**
 * A basic string Set.
 */
export type Set = Map<boolean>;

/**
 * Retrieve values of a map as aray.
 */
export function getMapValues<T>(map: Map<T>): T[] {
    return Object.keys(map).reduce( (result: T[], key: string) => {
        result.push(map[key]);
        return result;
    }, []);
} 

/**
 * convert an array of string to a string Set.
 */
export function arrayToSet(arr: string[]): Set {
    return arr.reduce((result: Set, key: string) => {
        result[key] = true;
        return result;
    }, Object.create(null));
}
