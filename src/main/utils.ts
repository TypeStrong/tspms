'use strict';

import promise                 = require('./promise');
import path                    = require('path');
import project                 = require('./project');
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


export function createMap(arr: string[]): { [string: string]: boolean} {
    return arr.reduce((result: { [string: string]: boolean}, key: string) => {
        result[key] = true;
        return result;
    }, <{ [string: string]: boolean}>{});
}


/**
 * browserify path.resolve is buggy on windows
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