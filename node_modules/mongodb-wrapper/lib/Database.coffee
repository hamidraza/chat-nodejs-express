CONN_CLOSED = 0
CONN_OPENING = 1
CONN_OPEN = 2
mongodb = require "mongodb"
async = require "async"

{EventEmitter} = require 'events'
url = require "url"

Collection = require "./Collection"

class Database extends EventEmitter
  constructor: (host, port, dbName, prefix = "", username, password) ->
    # attach everything to state object to avoid name collisions on collections
    @_state = {}
    @_state.prefix = prefix
    @_state.cbCache = new EventEmitter
    # we need a few more listeners here, this is mostly okay because we only use "once" instead of on
    @_state.cbCache.setMaxListeners 100

    @_normalizeParams host, port, dbName, username, password

    @_state.connection = null
    @_state.status = CONN_CLOSED
    @_state.collections = {}

  # we want to turn everything into a connectionString in order to support MongoClient
  _normalizeParams: (host, port, dbName, username, password) ->
    userpass = if username and password then "#{username}:#{password}@" else ""
    if Array.isArray host
      @_state.connectionString = @_makeReplConnString host, dbName, userpass
      # might need to do some munging of ops here...
      @_state.opts = port
    else if host.match(/^mongodb:\/\/.*/)
      @_state.connectionString = host
      @_state.opts = port
    else
      @_state.connectionString = @_makeConnString host, port, dbName, userpass
      @_state.opts = {}

    # since we conform to uri, we can just use url to parse out pathname (should be db)
    parsed = url.parse @_state.connectionString
    @_state.dbName = parsed.pathname.replace("/", "")
    @_state.hostname = parsed.hostname
    @_state.port = parsed.port

  _makeReplConnString: (hosts, dbName, userpass) ->
    prefix = "mongodb://#{userpass}"
    parts = []
    for host in hosts
      parts.push "#{host.host}:#{host.port}"

    return prefix + parts.join(",") + "/#{dbName}"

  _makeConnString: (host, port, dbName, userpass) ->
    "mongodb://#{userpass}#{host}:#{port}/#{dbName}"

  host: -> @_state.hostname
  port: -> @_state.port
  prefix: -> @_state.prefix
  name: -> @_state.dbName

  prefixName: (collName) ->
    return collName if not @_state.prefix
    return collName if collName.match(new RegExp("^#{@_state.prefix}\\."))
    return @_state.prefix + "." + collName

  _getConnection: (cb) ->
    switch @_state.status
      when CONN_CLOSED
        @_state.cbCache.once "open", cb
        @_openConnection()
      when CONN_OPENING
        @_state.cbCache.once "open", cb
      when CONN_OPEN
        cb null, @_state.connection
      else
        cb new Error("invalid connection state")
        
  _openConnection: ->
    @_state.status = CONN_OPENING
    mongodb.MongoClient.connect @_state.connectionString, @_state.opts, (err, connection) =>
      # on connection errors, we want to emit on top level so we can globally handle, but also need to return and release those waiting!
      if err
        @_state.status = CONN_CLOSED
        @emit "open", err
        return @emit "error", err

      @emit "opened"
      @_state.status = CONN_OPEN
      @_state.connection = connection
      @_state.connection.on "error", (err) =>
        @emit "error", err
      @_state.connection.on "closed", =>
        if @_state.status != CONN_CLOSED
          @emit "error", new Error("connection disconnected unexpectedly")
          @_state.status = CONN_CLOSED

        @emit "closed"

      @_state.cbCache.emit "open", null, connection

  currentConnection: -> @_state.connection

  close: ->
    @_state.status = CONN_CLOSED
    @_state.connection.close()

  # we want the params seperate from the cb so that we can cb on connection error, however
  # we still add it to the args array for doing apply
  runCommand: (command, params, cb) ->
    if typeof params == "function"
      cb = params
      params = []
    params.push cb
      
    @_getConnection (err, connection) ->
      return cb err if err?
      connection[command].apply connection, params

  collection: (collName) ->
    return @_state.collections[collName] if @_state.collections[collName]?

    nameParts = collName.split "."
    bottomLevelName = nameParts.pop()
    
    container = null
    for part in nameParts
      container = @[part] || {}
      # put in a guard to prevent properties/functions to be overriden on ourselves
      throw new Error("trying to attach collection name of existing property #{part}") if typeof container != "object"
      
      @[part] = container

    # handle the case where have a collection that is singular 
    container ||= @
    collection = new Collection(@, collName)
    collection.on "error", (err) =>
      @emit "error", err
    container[bottomLevelName] = collection
    @_state.collections[collName] = collection

    return collection

  auth: (username, password, cb) ->
    @runCommand "authenticate", [username, password], cb

  addUser: (username, password, cb) ->
    @runCommand "addUser", [username, password], cb

  removeUser: (username, cb) ->
    @runCommand "removeUser", [username], cb

  lastError: (cb) ->
    @runCommand "lastError", cb

  eval: (code, params, cb) ->
    if typeof params == "function"
      cb = params
      params ||= {}

    @runCommand "eval", [code, params], cb

  dropDatabase: (cb) ->
    @runCommand "dropDatabase", cb

  createCollection: (collName, opts, cb) ->
    @runCommand "createCollection", [collName, opts], cb
  
  getCollectionNames: (cb) -> 
    @runCommand "collectionNames", (err, names) =>
      return cb err if err
      
      filtered = []
      for name in names
        filtered.push names.replace @_state.dbName + ".", ""

      cb null, filtered

  dropCollection: (collectionName, cb) ->
    @runCommand "dropCollection", [collectionName], cb
  
  dropAllCollections: (cb) ->
    dropSingle = (coll, acb) ->
      coll.drop acb

    async.forEach @_state.collections, dropSingle, cb

  dropAllCollectionsOnServer: (cb) ->
    @getCollectionNames (err, names) =>
      return cb err if err

      dropSingle = (collName, acb) =>
        return acb() if collName.match(/^system.*/)
        coll = new Collection @, collName
        coll.drop acb

      async.forEach names, dropSingle, cb

  renameCollection: (fromCollection, toCollection, cb) ->
    @runCommand "renameCollection", [fromCollection, toCollection], cb

module.exports = Database
