//   Copyright 2013-2014 François de Campredon
//
//   Licensed under the Apache License, Version 2.0 (the "License");
//   you may not use this file except in compliance with the License.
//   You may obtain a copy of the License at
//
//       http://www.apache.org/licenses/LICENSE-2.0
//
//   Unless required by applicable law or agreed to in writing, software
//   distributed under the License is distributed on an "AS IS" BASIS,
//   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//   See the License for the specific language governing permissions and
//   limitations under the License.
'use strict';
var Promise = require('bluebird');
var path = require('path');
/**
 * A simple Promise Queue
 */
var PromiseQueue = (function () {
    function PromiseQueue() {
        var _this = this;
        /**
         * true if the queue has been initialized
         */
        this.initialized = false;
        this.promise = new Promise(function (resolve) {
            _this.initializer = resolve;
        });
    }
    /**
     * initialize the queue subsequent call reset the queue
     *
     * @param val the value passed as initialial result
     */
    PromiseQueue.prototype.init = function (val) {
        if (this.initialized) {
            this.promise = Promise.cast(val);
        }
        else {
            this.initialized = true;
            this.initializer(val);
            return this.promise;
        }
    };
    /**
     * enqueue an action
     */
    PromiseQueue.prototype.then = function (action) {
        return this.promise = this.promise.then(function () { return action(); }, function () { return action(); });
    };
    return PromiseQueue;
})();
exports.PromiseQueue = PromiseQueue;
function mapValues(map) {
    return Object.keys(map).reduce(function (result, key) {
        result.push(map[key]);
        return result;
    }, []);
}
exports.mapValues = mapValues;
/**
 * assign all properties of a list of object to an object
 * @param target the object that will receive properties
 * @param items items which properties will be assigned to a target
 */
function assign(target) {
    var items = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        items[_i - 1] = arguments[_i];
    }
    return items.reduce(function (target, source) {
        return Object.keys(source).reduce(function (target, key) {
            target[key] = source[key];
            return target;
        }, target);
    }, target);
}
exports.assign = assign;
/**
 * clone an object (shallow)
 * @param target the object to clone
 */
function clone(target) {
    return assign(Array.isArray(target) ? [] : {}, target);
}
exports.clone = clone;
function createMap(arr) {
    return arr.reduce(function (result, key) {
        result[key] = true;
        return result;
    }, {});
}
exports.createMap = createMap;
/**
 * browserify path.resolve is buggy on windows
 */
function pathResolve(from, to) {
    var result = path.resolve(from, to);
    var index = result.indexOf(from[0]);
    return result.slice(index);
}
exports.pathResolve = pathResolve;
/**
 * Default configuration for typescript project
 */
exports.typeScriptProjectConfigDefault = {
    noLib: false,
    target: 'es3',
    module: 'none',
    noImplicitAny: false
};
var Signal = (function () {
    function Signal() {
        /**
         * list of listeners that have been suscribed to this signal
         */
        this.listeners = [];
        /**
         * Priorities corresponding to the listeners
         */
        this.priorities = [];
    }
    /**
     * Subscribes a listener for the signal.
     *
     * @params listener the callback to call when events are dispatched
     * @params priority an optional priority for this signal
     */
    Signal.prototype.add = function (listener, priority) {
        if (priority === void 0) { priority = 0; }
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
    };
    /**
     * unsubscribe a listener for the signal
     *
     * @params listener the previously subscribed listener
     */
    Signal.prototype.remove = function (listener) {
        var index = this.listeners.indexOf(listener);
        if (index >= 0) {
            this.priorities.splice(index, 1);
            this.listeners.splice(index, 1);
        }
    };
    /**
     * dispatch an event
     *
     * @params parameter the parameter attached to the event dispatching
     */
    Signal.prototype.dispatch = function (parameter) {
        var hasBeenCanceled = this.listeners.every(function (listener) {
            var result = listener(parameter);
            return result !== false;
        });
        return hasBeenCanceled;
    };
    /**
     * Remove all listener from the signal
     */
    Signal.prototype.clear = function () {
        this.listeners = [];
        this.priorities = [];
    };
    /**
     * @return true if the listener has been subsribed to this signal
     */
    Signal.prototype.hasListeners = function () {
        return this.listeners.length > 0;
    };
    return Signal;
})();
exports.Signal = Signal;
function binarySearch(array, value) {
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
exports.binarySearch = binarySearch;
