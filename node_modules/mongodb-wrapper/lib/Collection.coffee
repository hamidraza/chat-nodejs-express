CONN_CLOSED = 0
CONN_OPEN = 1

{EventEmitter} = require 'events'

sortSyntax = require "./sortSyntax"
Cursor = require "./Cursor"

noop = ->

class Collection extends EventEmitter

  constructor: (@db, @collName) ->
    @state = CONN_CLOSED
    @queue = []
    @db._getConnection (err, connection) =>
      return @emit "error", err if err

      connection.collection @collName, (err, collection) =>
        return @emit "error", err if err

        @state = CONN_OPEN
        @_collection = collection
        @emit "ready"
        @drainQueue()

  isOpen: -> @state == CONN_OPEN
  rawCollection: -> @_collection

  name: -> @collName

  database: -> @db

  drainQueue: ->
    for item in @queue
      @_runCommand item.name, item.params, item.cb

  runCommand: (name, params, cb) ->
    if @state is CONN_CLOSED
      return @queue.push {name, params, cb}
    else
      @_runCommand name, params, cb

  _runCommand: (name, params, cb) ->
    if typeof params == "function"
      cb = params
      params = []
    params ||= []
    params.push cb

    @_collection[name].apply @_collection, params

  ensureIndex: (index, options, cb) ->
    @runCommand "ensureIndex", [index, options], cb

  dropIndexes: (cb) ->
    @runCommand "dropAllIndexes", cb

  renameCollection: (targetName, dropTarget, cb) ->
    if typeof dropTarget == "function"
      cb = dropTarget
      dropTarget = false

    # we sometimes do this without a cb...
    cb ||= noop

    if dropTarget
      @db.dropCollection targetName, (err) =>
        return cb err if err

        @db.renameCollection @collName, @db.prefixName(targetName), cb
    else
      @db.renameCollection @collName, @db.prefixName(targetName), cb

  insert: (docs, cb) ->
    cb ||= noop
    @runCommand "insert", [docs], cb

  remove: (selector, cb) ->
    cb ||= noop
    @runCommand "remove", [selector], cb

  drop: (cb) ->
    cb ||= noop
    @runCommand "drop", (err) ->
      return cb() if err and err.message == "ns not found"
      cb err

  save: (doc, cb) ->
    cb ||= noop
    @runCommand "save", [doc], cb

  update: (selector, updates, upsert, multi, cb) ->
    if typeof upsert == "function"
      cb = upsert
      upsert = false
      multi = false
    else if typeof multi == "function"
      cb = multi
      multi = false

    options = {
      upsert: upsert
      multi: multi
    }

    cb ||= noop
    @runCommand "update", [selector, updates, options], cb

  count: (cb) ->
    @runCommand "count", cb

  findAndModify: (options, cb) ->
    cb ||= noop

    query = options.query || {}
    sort = if options.sort then sortSyntax(options.sort) else []
    update = options.update || {}
    fields = options.fields || {}
    delete options.query
    delete options.sort
    delete options.update
    @runCommand "findAndModify", [query, sort, update, options], cb

  find: (selector, fields) ->
    selector ||= {}
    fields ||= {}
    return new Cursor @, selector, fields

  findOne: (selector, fields, cb) ->
    if typeof selector == "function"
      cb = selector
      selector = {}
      fields = {}
    else if typeof fields == "function"
      cb = fields
      fields = {}
      selector ||= {}

    @runCommand "findOne", [selector, fields], cb

  group: (options, cb) ->
    cb ||= noop
    options ||= {}
    reduce = options.reduce || options['$reduce'] || noop
    cond = options.cond || {}
    key = options.key || {}
    initial = options.intial || {}
    @runCommand "group", [key, cond, initial, reduce], cb

  mapReduce: (map, reduce, options, cb) ->
    cb ||= noop
    @runCommand "mapReduce", [map, reduce, options], cb

  distinct: (key, query, cb) ->
    if typeof query == "function"
      cb = query
      query = null

    @runCommand "distinct", [key, query], cb

module.exports = Collection
