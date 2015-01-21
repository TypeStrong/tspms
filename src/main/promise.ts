
module Promise {
    export interface Thenable<R> {
        then<U>(onFulfilled: (value: R) => Thenable<U>,  onRejected: (error: any) => Thenable<U>): Thenable<U>;
        then<U>(onFulfilled: (value: R) => Thenable<U>, onRejected?: (error: any) => U): Thenable<U>;
        then<U>(onFulfilled: (value: R) => U, onRejected: (error: any) => Thenable<U>): Thenable<U>;
        then<U>(onFulfilled?: (value: R) => U, onRejected?: (error: any) => U): Thenable<U>;
    }
}


interface Promise<R>  {


    /**
     * onFulFill is called when/if "promise" resolves. onRejected is called when/if "promise" rejects. 
     * Both are optional, if either/both are omitted the next onFulfilled/onRejected in the chain is called. 
     * Both callbacks have a single parameter , the fulfillment value or rejection reason. 
     * "then" returns a new promise equivalent to the value you return from onFulfilled/onRejected after 
     * being passed through Promise.resolve. 
     * If an error is thrown in the callback, the returned promise rejects with that error.
     * 
     * @param onFulFill called when/if "promise" resolves
     * @param onReject called when/if "promise" rejects
     */
    then<U>(onFulfill: (value: R) => Promise.Thenable<U>,  onReject: (error: any) => Promise.Thenable<U>): Promise<U>;
    /**
     * onFulFill is called when/if "promise" resolves. onRejected is called when/if "promise" rejects. 
     * Both are optional, if either/both are omitted the next onFulfilled/onRejected in the chain is called. 
     * Both callbacks have a single parameter , the fulfillment value or rejection reason. 
     * "then" returns a new promise equivalent to the value you return from onFulfilled/onRejected after 
     * being passed through Promise.resolve. 
     * If an error is thrown in the callback, the returned promise rejects with that error.
     * 
     * @param onFulFill called when/if "promise" resolves
     * @param onReject called when/if "promise" rejects
     */
    then<U>(onFulfill: (value: R) => Promise.Thenable<U>, onReject?: (error: any) => U): Promise<U>;
    /**
     * onFulFill is called when/if "promise" resolves. onRejected is called when/if "promise" rejects. 
     * Both are optional, if either/both are omitted the next onFulfilled/onRejected in the chain is called. 
     * Both callbacks have a single parameter , the fulfillment value or rejection reason. 
     * "then" returns a new promise equivalent to the value you return from onFulfilled/onRejected after 
     * being passed through Promise.resolve. 
     * If an error is thrown in the callback, the returned promise rejects with that error.
     * 
     * @param onFulFill called when/if "promise" resolves
     * @param onReject called when/if "promise" rejects
     */
    then<U>(onFulfill: (value: R) => U, onReject: (error: any) => Promise.Thenable<U>): Promise<U>;
    /**
     * onFulFill is called when/if "promise" resolves. onRejected is called when/if "promise" rejects. 
     * Both are optional, if either/both are omitted the next onFulfilled/onRejected in the chain is called. 
     * Both callbacks have a single parameter , the fulfillment value or rejection reason. 
     * "then" returns a new promise equivalent to the value you return from onFulfilled/onRejected after 
     * being passed through Promise.resolve. 
     * If an error is thrown in the callback, the returned promise rejects with that error.
     * 
     * @param onFulFill called when/if "promise" resolves
     * @param onReject called when/if "promise" rejects
     */
    then<U>(onFulfill?: (value: R) => U, onReject?: (error: any) => U): Promise<U>;


    /**
     * Sugar for promise.then(undefined, onRejected)
     * 
     * @param onReject called when/if "promise" rejects
     */
    catch<U>(onReject?: (error: any) => Promise.Thenable<U>): Promise<U>;
    /**
     * Sugar for promise.then(undefined, onRejected)
     * 
     * @param onReject called when/if "promise" rejects
     */
    catch<U>(onReject?: (error: any) => U): Promise<U>;
}


export = Promise;