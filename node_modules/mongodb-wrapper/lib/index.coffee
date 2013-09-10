Database = require "./Database"
Cursor = require "./Cursor"
Collection = require "./Collection"
mongodb = require "mongodb"

module.exports.db = (host, port, name, prefix, username, password) ->
  return new Database(host, port, name, prefix, username, password)

module.exports.Cursor = Cursor
module.exports.Collection = Collection
module.exports.Database = Database

module.exports.ObjectID = mongodb.BSONPure.ObjectID
module.exports.Timestamp = mongodb.BSONPure.Timestamp
