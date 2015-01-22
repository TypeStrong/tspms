//see https://github.com/bramstein/promis/

export interface Thenable<R> {
    then<U>(onFulfill?: (value: R) => Thenable<U> | U, onReject?: (error: any) => Thenable<U> | U): Promise<U>;
}


const enum State {
    PENDING,
    REJECTED,
    RESOLVED
}

interface PromiseInternal<R> {
    state: State;
    value: R;
    deferred: [
        (value: R) => Thenable<any> | any, 
        (error: any) => Thenable<any> | any, 
        (result: R | Thenable<R>) => void, 
        (error: any) => void
    ][]
}

var internalId = 'Promise_internal' + (Math.random() * 1e9 >>> 0);

function setPromiseInternal<R>(promise: Promise<R>, internal: PromiseInternal<R>) {
    Object.defineProperty(promise, internalId, {
        value: internal,
        writable: true
    })
}

function getPromiseInternal<R>(promise: Promise<R>): PromiseInternal<R> {
    return (<any>promise)[internalId];
}

function resolve<R>(promise: Promise<R>, result: R | Thenable<R>) {
    var promiseInternal = getPromiseInternal(promise);
    if (promiseInternal.state === State.PENDING) {
        if (result === promise) {
            throw new TypeError('Promise resolved with itself.');
        }

        var called = false;

        try {
            var then = Object(result) === result && (<any>result).then;
            if (typeof then === 'function') {
                then.call(
                    result, 
                    function (newResult: R) {
                        if (!called) {
                            resolve(promise, newResult);
                        }
                        called = true;
                    }, function (error: any) {
                        if (!called) {
                            reject(promise, error);
                        }
                        called = true;
                    }
                );
                return;
            }
        } catch (e) {
            if (!called) {
                reject(promise, e);
            }
            return;
        }
        promiseInternal.state = State.RESOLVED;
        promiseInternal.value = <any>result;
        notify(promise);
    }
};

function reject<R>(promise: Promise<R>, error: any) {
    var promiseInternal = getPromiseInternal(promise);
    if (promiseInternal.state === State.PENDING) {
        if (error === promise) {
            throw new TypeError('Promise rejected with itself.');
        }

        promiseInternal.state = State.REJECTED;
        promiseInternal.value = error;
        notify(promise);
    }
}



function notify<R>(promise: Promise<R>) {
    schedule(function () {
        var promiseInternal = getPromiseInternal(promise);
        if (promiseInternal.state !== State.PENDING) {
            while (promiseInternal.deferred.length) {
                var deferred = promiseInternal.deferred.shift(),
                    onResolved = deferred[0],
                    onRejected = deferred[1],
                    resolve = deferred[2],
                    reject = deferred[3];

                try {
                    if (promiseInternal.state === State.RESOLVED) {
                        if (typeof onResolved === 'function') {
                            resolve(onResolved.call(undefined, promiseInternal.value));
                        } else {
                            resolve(promiseInternal.value);
                        }
                    } else if (promiseInternal.state === State.REJECTED) {
                        if (typeof onRejected === 'function') {
                            resolve(onRejected.call(undefined, promiseInternal.value));
                        } else {
                            reject(promiseInternal.value);
                        }
                    }
                } catch (e) {
                    reject(e);
                }
            }
        }
    });
}


declare function setTimeout(callback: () => any, time?: number): number;



var queue: (() => any)[] = [];
function drainQueue() {
    while (queue.length > 0) {
        var fn = queue.shift();
        fn();
    }   
}

function schedule(callback: () => any) {
    queue.push(callback);
    setTimeout(drainQueue, 0)
}



export class Promise<R> implements Thenable<R> {


    constructor(callback: (resolve: (result: R | Thenable<R>) => void, reject: (error: any) => void) => void) {

        setPromiseInternal(this, {
            value: undefined,
            state: State.PENDING,
            deferred: []
        })

        try {
            callback(r => resolve(this, r), e => reject(this, e));
        } catch (e) {
            reject(this, e);
        }
    }

    then<U>(onFulfill?: (value: R) => Thenable<U> | U, onReject?: (error: any) => Thenable<U> | U): Promise<U> {
        return new Promise((resolve, reject) => {
            var promiseInternal = getPromiseInternal(this)
            promiseInternal.deferred.push([onFulfill, onReject, resolve, reject]);
            notify(this);
        });
    }

    catch<U>(onReject?: (error: any) => Thenable<U> | U): Promise<U> {
        return this.then(undefined, onReject);
    }

    static resolve<T>(object?: T | Thenable<T>): Promise<T> {
        if (object instanceof Promise) {
            return object;
        }
        return new Promise(function (resolve, reject) {
            resolve(object);
        });
    }

    static reject<T>(error?: any): Promise<T> {
        return new Promise(function (resolve, reject) {
            reject(error);
        });
    }

    static all<T>(promises: (Thenable<T> | T)[]): Promise<T[]> {
        return new Promise(function (resolve, reject) {
            var count = 0,
                result: T[] = [];

            if (promises.length === 0) {
                resolve(result);
            }

            for (var i = 0; i < promises.length; i += 1) {
                Promise.resolve(promises[i]).then(x => {
                    result[i] = x;
                    count += 1;

                    if (count === promises.length) {
                        resolve(result);
                    }
                }, reject);
            }
        });
    }

    static race<T>(promises: (Thenable<T> | T)[]): Promise<T> {
        return new Promise(function (resolve, reject) {
            for (var i = 0; i < promises.length; i += 1) {
                Promise.resolve(promises[i]).then(resolve, reject);
            }
        });
    }
}

declare var exports: any;
export function injectPromiseLibrary(promise: typeof Promise): void {
    exports.Promise = promise;
}