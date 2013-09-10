sortSyntax = require "./sortSyntax"
{EventEmitter} = require 'events'

class Cursor extends EventEmitter
  constructor: (@collection, @selector, @fields) ->
    @_order = []
    if @collection.isOpen()
      @_collection = @collection.rawCollection()
    else
      @collection.once "error", (err) =>
        @hasError = err
        @emit "error", err
      @collection.once "ready", =>
        @_collection = @collection.rawCollection()
        @emit "ready"

  resolve: (cb) ->
    if @_collection
      @_resolve cb
    else if @hasError
      cb @hasError
    else
      @once "ready", =>
        @_resolve cb
      @once "error", cb

  _resolve: (cb) ->
    if @_cursor
      cb null, @_cursor
    else
      cursor = @_collection.find @selector, @fields
      for item in @_order
        cursor = cursor[item[0]].apply cursor, item[1]

      @_cursor = cursor
      cb null, @_cursor
  
  limit: (limit) ->
    @_order.push ["limit", [limit]]
    return @

  skip: (skip) ->
    @_order.push ["skip", [skip]]
    return @

  sort: (fields) ->
    @_order.push ["sort", [sortSyntax(fields)]]
    return @
    
  one: (cb) ->
    @resolve (err, cursor) =>
      return cb err if err
      cursor.nextObject cb
    return @

  next: (cb) ->
    @resolve (err, cursor) =>
      return cb err if err
      cursor.nextObject cb
    return @
        
  each: (cb) ->
    @resolve (err, cursor) =>
      return cb err if err
      cursor.each cb
    return @

  explain: (cb) ->
    @resolve (err, cursor) =>
      return cb err if err
      cursor.explain cb
    return @
        
  toArray: (cb) ->
    @resolve (err, cursor) =>
      return cb err if err
      cursor.toArray cb
    return @

  count: (cb) ->
    @resolve (err, cursor) =>
      return cb err if err
      cursor.count cb
    return @

  getRawCursor: (cb) ->
    @resolve cb

module.exports = Cursor
