/**
   ________________________________________________________________________________
   
      ___          ______                
     / _ \         | ___ \               
    / /_\ \ ___ ___| |_/ / __ _ ___  ___ 
    |  _  |/ __/ _ \ ___ \/ _` / __|/ _ \
    | | | | (_|  __/ |_/ / (_| \__ \  __/
    \_| |_/\___\___\____/ \__,_|___/\___|
                                     
   Copyright 2018 by Ewout Stortenbeker (me@appy.one)   
   Published under MIT license
   ________________________________________________________________________________
  
 */
const { EventEmitter } = require('events');
const { TypeMappings } = require('./type-mappings');
const { StorageOptions } = require('./storage');
const { DataReference, DataReferenceQuery } = require('./data-reference');
const debug = require('./debug');

class AceBaseSettings {
    constructor(options) {
        this.logLevel = options.logLevel || "log";
        this.api = options.api || null;
        this.storage = new StorageOptions(options.storage);
    }
}

class AceBase extends EventEmitter {

    /**
     * 
     * @param {string} dbname | Name of the database to open or create
     * @param {AceBaseSettings} options | 
     */
    constructor(dbname, options) {
        super();

        const db = this;
        if (!options) { options = {}; }
        if (options.logLevel) {
            debug.setLevel(options.logLevel);
        }

        this.once("ready", () => {
            this._ready = true;
        });

        if (options.api) {
            // Specific api given such as web api, or browser api etc
            this.api = new options.api.class(dbname, options.api.settings, (ready) => {
                this.emit("ready");
            });
        }
        else {
            // Use local database
            const { Storage } = require('./storage');
            const storage = new Storage(dbname, options.storage);
            storage.on("ready", () => this.emit("ready"));

            const { LocalApi } = require('./api-local');
            this.api = new LocalApi(db, storage);     
            storage.on("datachanged", (event) => {
                debug.warn(`datachanged event fired for path ${event.path}`);
                //debug.warn(event);
                //storage.subscriptions.trigger(db, event.type, event.path, event.previous);
                this.emit("datachanged", event);
            });
        }

        this.types = new TypeMappings();
        // this.schema = {
        //     global: {
        //         //include: [],
        //         exclude: []
        //     }
        // }
    }

    /**
     * 
     * @param {()=>void} callback (optional) callback function that is called when ready. You can also use the returned promise
     * @returns {Promise<void>} returns a promise that resolves when ready
     */
    ready(callback = undefined) {
        if (this._ready === true) { 
            // ready event was emitted before
            callback && callback();
            return Promise.resolve();
        }
        else {
            // Wait for ready event
            let resolve;
            const promise = new Promise(res => resolve = res);
            this.on("ready", () => {
                resolve();
                callback && callback(); 
            });
            return promise;
        }
    }

    /**
     * Creates a reference to a node
     * @param {string} path 
     * @returns {DataReference} reference to the requested node
     */
    ref(path) {
        return new DataReference(this, path);
    }

    /**
     * Get a reference to the root database node
     * @returns {DataReference} reference to root node
     */
    get root() {
        return this.ref("");
    }

    /**
     * Creates a query on the requested node
     * @param {string} path 
     * @returns {DataReferenceQuery} query for the requested node
     */
    query(path) {
        const ref = new DataReference(this, path);
        return new DataReferenceQuery(ref);
    }

    get indexes() {
        return {
            /**
             * Gets all indexes
             */
            get: () => {
                return this.api.getIndexes();
            },
            /**
             * Creates an index on "key" for all child nodes at "path". If the index already exists, nothing happens.
             * Example: creating an index on all "name" keys of child objects of path "system/users", 
             * will index "system/users/user1/name", "system/users/user2/name" etc.
             * You can also use wildcard paths to enable indexing and quering of fragmented data.
             * Example: path "users/*\/posts", key "title": will index all "title" keys in all posts of all users.
             * @param {string} path
             * @param {string} key
             */
            create: (path, key) => {
                return this.api.createIndex(path, key);
            }
        };
    }

}

module.exports = { AceBase, AceBaseSettings };