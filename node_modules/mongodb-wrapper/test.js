
var util = require('util')
var assert = require('assert')

// normally you make one per test, but here
// we'll reuse it for each
var mongo = require('./lib/')    

describe("authentication", function() {

  it("auth should fail", function(done) {
    var db = mongo.db('localhost', 27017, 'test', null, 'baduser', 'badpass')
    db.on("error", function(err) {
      assert.ok(err, "Authentication should fail")
      done()
    }) 
    db.collection('mongo.auth')
  })

  it("auth should pass", function(done) {
    var db = mongo.db('localhost', 27017, 'test')

    db.addUser('user', 'pass', function(err) {
      assert.ifError(err)

      db.auth('user', 'pass', function(err) {
        assert.ifError(err)

        var db = mongo.db('localhost', 27017, 'test', null, 'user', 'pass')
        db.collection('mongo.auth')
        db.mongo.auth.save({one:"two"}, function(err, doc) {
          assert.ifError(err)

          db.removeUser('user', function(err) {
            assert.ifError(err)
            done()
          })
        })
      })
    })
  })
})

describe("basics", function() {
  var db = mongo.db("localhost", 27017, "test")
  it("should have some basic properties and not fail", function() {
    db.collection('mongo.basics')
    db.toString()

    // basic coverage for syntax errors
    db.mongo.basics.toString()

    assert.ok(db.mongo.basics.database())
    assert.equal(db.host(), "localhost")
    assert.equal(db.port(), 27017)
    
    var prefixedDb = mongo.db("localhost", 27017, "test", "prefix")
    assert.equal(prefixedDb.prefix(), "prefix")
  })

  it("should be able to be dropped and have a basic save", function(done) {
    // same
    db.mongo.basics.drop(function(err) {
      if (err) throw new Error(err) 

      db.mongo.basics.save({ _id: "one", property: "value" }, function(err, doc) {
        if (err) throw err 

        db.mongo.basics.findOne(function(err, doc) {
          if (err) throw err 
          assert.equal(doc._id, "one")
          assert.equal(doc.property, "value")
          done()
        })
      })
    })
  })
})

describe("eval", function() {
  it("should be able to do some basic eval stuff", function(done) {
    var db = mongo.db("localhost", 27017, "test")
    db.collection('mongo.testEval')
    
    function go() {
      db.mongo.testEval.save({_id:'woot'})
    }
    
    db.eval(go, {}, function(err) {
      assert.ifError(err)
    
      db.eval(go, function(err) {
        db.mongo.testEval.findOne({}, function(err, doc) {
          assert.ifError(err)
          assert.ok(doc, "Didn't find anything")
          assert.equal(doc._id, "woot")
          done()
        })      
      })
    })
  })
})

describe("distinct", function() {
  it("should support the distinct operation", function(done) {

    var db = mongo.db("localhost", 27017, "test")
    db.collection('mongo.distinct')

    db.mongo.distinct.insert({_id:"A", name:"henry"})
    db.mongo.distinct.insert({_id:"B", name:"henry"}) 
    db.mongo.distinct.insert({_id:"C", name:"joe"}, function(err) {
      db.mongo.distinct.distinct("name", {}, function(err, names) {
        assert.ifError(err)
        assert.ok(names)
        done()
      })
    })
  })
})





describe("group", function() {
  it("should support the group operation", function(done) {
    var db = mongo.db("localhost", 27017, "test")
    db.collection('mongo.testGR')
    db.collection('mongo.outGR')
    db.mongo.testGR.remove({})
    db.mongo.testGR.insert([{_id:"one",friends:[{name:"bad",count:2}]}, {_id:"two",friends:[{name:"bad", count:3},{name:"salsa", count:4}]}], function(err) {
      db.mongo.testGR.group({
        key: {},
        cond: {friends:{$exists:true}},
        initial: {},
        reduce: function(obj, out) {
          obj.friends.forEach(function(friend) {
            if (!out[friend.name]) out[friend.name] = 0
            out[friend.name] += friend.count
          })
        }
      }, 
      function(err, result) {
        assert.ifError(err)
        assert.equal(result[0].bad, 5)
        assert.equal(result[0].salsa, 4)
        done()
      })        
    })
  })
})

describe("findAndModify", function() {
  it("should support find and modify", function(done) {
    var db = mongo.db("localhost", 27017, "test");
    db.collection('mongo.testFM');
    db.mongo.testFM.drop();
    db.mongo.testFM.insert({_id:"one", count:1, junk:"trash"}, function(err) {
      assert.ifError(err)
      db.mongo.testFM.findAndModify({
        query:{_id:"one"},
        fields:{junk:0},
        update:{$inc:{count:1}},
        new: true         
      },
      function(err, result) {
        assert.ifError(err)
        assert.equal(result.count, 2)
        assert.ok(!result.junk)
        done()
      }) 
    })
  })
})

describe("mapReduce", function() {
  it("should support map reduce", function(done) {
    var db = mongo.db("localhost", 27017, "test")
    db.collection('mongo.testMR')
    db.collection('mongo.outMR')
    
    db.mongo.testMR.insert([{_id:"one"}, {_id:"two"}], function(err) {
      db.mongo.testMR.mapReduce(function() {
        emit("henry " + this._id, "goof")
      }, 
      function (key, values) {
        return values[0]
      }, 
      {
        out: "mongo.outMR"
      }, 
      function(err) {
        assert.ifError(err)
        db.mongo.outMR.find().toArray(function(err, docs) {
          assert.ifError(err)
          assert.equal(docs.length, 2, "Didn't find docs in map reduce")
          assert.equal(docs[0].value, "goof")
          assert.ok(docs[0]._id.match(/henry/))
          done()
        })
      })        
    })
  })
})



describe("renameCollection", function() {
  it("should be able to do lots of renames", function(done) {
    var db = mongo.db("localhost", 27017, "test")
    db.collection('mongo.startname')
    db.collection('mongo.endname')
    db.collection('mongo.toreplace')

    db.mongo.startname.drop(function(err) {
      assert.ifError(err)
    })

    db.mongo.endname.drop(function(err) {
      assert.ifError(err)
    })

    db.mongo.toreplace.drop(function(err) {
      assert.ifError(err)
    })

    db.mongo.startname.ensureIndex({ value: 1 }, function(err) {
      assert.ifError(err)

      db.mongo.startname.save({ _id: "woot", value: "value" }, function(err, doc) {
        assert.ifError(err)

        db.mongo.startname.count(function(err, num) {
          assert.ifError(err)
          assert.equal(num, 1, "Wrong number saved in renameCollection")

          db.mongo.startname.renameCollection('mongo.endname', function(err) {
            assert.ifError(err)

            db.mongo.startname.count(function(err, num) {
              assert.ifError(err)
              assert.equal(num, 0, "startname shouldn't have items any more")

              db.mongo.endname.count(function(err, num) {
                assert.ifError(err)
                assert.equal(num, 1, "endname should have starts items")

                db.mongo.toreplace.save({ _id: "boot", value: "value" }, function(err, doc) {
                  assert.ifError(err)

                  db.mongo.endname.renameCollection('mongo.toreplace', true, function(err) {
                    assert.ifError(err)

                    var cursor = db.mongo.toreplace.find({ value: "value" }).one(function(err, doc) {
                      assert.ifError(err)
                      assert.notEqual(doc._id, "boot", "Didn't replace collection " + doc)
                      assert.equal(doc._id, "woot", "Wrong id for doc " + (util.inspect(doc)))

                      cursor.explain(function(err, explanation) {
                        assert.ifError(err)
                        assert.notEqual(explanation.cursor, mongo.Cursor.BasicCursor, "Didn't carry over indices")
                        done()
                      })
                    })
                  })
                })
              })
            })
          })
        })
      })
    })
  })
})


describe("collectionnames", function() {
  it("shouldn't allow us to do collection names that are bad", function() {
    var db = mongo.db("localhost", 27017, "test")
    try {
      db.collection('mongo.collection.names.one')
      db.collection('mongo.collection.names.two')
    } catch (err) {
      assert.ok(err)
    }
  })
})


describe("redefineCollection", function() {
  it("should allow us to redefine a collection", function() {
    var collection, db, secondCollection
    db = mongo.db("localhost", 27017, "test")
    collection = db.collection('mongo.redefineCollection')
    secondCollection = db.collection(collection.name())
    assert.equal(collection, secondCollection, "Should have reused collection when redefining")
  })
})


describe("failedInsert", function() {
  it("duplicate key inserts should fail", function(done) {
    var db = mongo.db("localhost", 27017, "test")
    var collection = db.collection('mongo.failedinsert')

    // Expected behavior is that the second batch-insert fails. That's really too
    // bad. It would have been nice if there weren't any discrepancies. 
    // Well, I can insert one, I guess

    collection.insert([{ _id: "A" }, { _id: "B" }], function(err, docs) {
      assert.ifError(err)

      collection.insert([{ _id: "B" }, { _id: "C" }], function(err, docs) {
        // there should be errors here
        assert.ok(err)

        collection.find().toArray(function(err, docs) {
          assert.ifError(err)
          assert.equal(docs.length, 2, "Doc C got through. I expected it to fail!")
          done()
        })
      })
    })
  })
})


describe("finding", function() {
  function assertError(err) { assert.ifError(err) }

  it("should be able to find things", function(done) {
    var collection, db
    db = mongo.db("localhost", 27017, "test")
    db.collection('mongo.finding')
    collection = db.mongo.finding

    collection.drop(function(err) {
      var cursor, eachIndex, ids
      if (err) throw err 

      collection.save({ _id: "A", color: "red", size: 8 }, assertError)
      collection.save({ _id: "B", color: "red", size: 6 }, assertError)
      collection.save({ _id: "C", color: "blue", size: 5 }, assertError)
      collection.save({ _id: "D", color: "blue", size: 4 }, function(err) {
        collection.find({}, { color: 1 }).limit(2).skip(1).sort({ _id: 1 }).toArray(function(err, docs) {
          if (err) throw err 
          assert.equal(docs[0]._id, "B", "found the wrong document. Should have been B " + (util.inspect(docs)))
          assert.equal(docs[0].size, null, "did not limit the fields returned " + (util.inspect(docs)))
          assert.equal(docs[1]._id, "C")
        })

        collection.findOne({ _id: "B" }, function(err, doc) {
          if (err) throw err 
          assert.equal(doc._id, "B")
        })
        // Test Each
        ids = ['A', 'B', 'C', 'D']
        eachIndex = 0

        // each is deprecated for now. Not in use
        // collection.find().each(function(err, doc) {
        //     if (err) throw err 
        //     if (doc) assert.equal(ids[eachIndex], doc._id) 
        //     eachIndex++
        // })

        collection.count(function(err, num) {
          if (err) throw err 
          assert.equal(num, 4)
        })
        
        cursor = collection.find()

        cursor.next(function(err, doc) {
          if (err) throw err 
          assert.equal(doc._id, "A")

          cursor.next(function(err, doc) {
            assert.equal(doc._id, "B")
            done()
          })
        })
      })
    })
  })

  it("should be able to sort the findings", function(done) {
    var collection, db
    db = mongo.db("localhost", 27017, "test")
    db.collection('mongo.finding')
    collection = db.mongo.finding

    collection.drop(function(err) {
      var cursor, eachIndex, ids
      if (err) throw err

      collection.save({ _id: "A", color: "red", size: 8 }, assertError)
      collection.save({ _id: "B", color: "red", size: 6 }, assertError)
      collection.save({ _id: "C", color: "blue", size: 5 }, assertError)
      collection.save({ _id: "D", color: "blue", size: 4 }, function(err) {
        collection.find({}, {size: 1}).sort({size: 1}).limit(1).toArray(function(err, docs) {
          if (err) throw err
          assert.equal(docs[0].size, 4, "found the wrong document. Should have been D " + (util.inspect(docs)))

          collection.find({}, {size: 1}).sort({size: -1}).limit(1).toArray(function(err, docs) {
            if (err) throw err
            assert.equal(docs[0].size, 8, "found the wrong document. Should have been A " + (util.inspect(docs)))
            done()
          })
        })
      })
    })
  })
})


describe("maintenance", function() {
  it("explain should work", function(done) {
    var db, maintenance
    db = mongo.db("localhost", 27017, "test")
    db.collection('mongo.maintenance')
    maintenance = db.mongo.maintenance

    maintenance.drop(function(err) {
      if (err) throw err 
      // Test double-drop

      maintenance.drop(function(err) {
        if (err) throw err 

        maintenance.save({ _id: "A", property: "value" })
        maintenance.save({ _id: "B", property: "value" })
        maintenance.save({ _id: "C", property: "value" })

        maintenance.find({ _id: "A" }).explain(function(err, explanation) {
          if (err) throw err 
          assert.equal(explanation.nscanned, 1)
        })

        db.lastError(function(err, something) {
          if (err) throw err 
          assert.ok(true)
          done()
        })
      })
    })
  })
})


describe("saving", function() {
  it("should be able to save data", function(done) {
    var db, saving
    db = mongo.db("localhost", 27017, "test")
    db.collection('mongo.saving')
    saving = db.mongo.saving

    saving.drop(function(err) {
      if (err) throw err 
      // Test guaranteed ordering

      saving.save({ _id: "A" })
      saving.save({ _id: "B" })
      saving.save({ _id: "C" }, function(err) {
        saving.find().toArray(function(err, docs) {
          if (err) throw err 
          assert.equal(docs.length, 3)
          // upsert

          saving.update({ _id: "D" }, { $set: { updated: "yep" } }, true, function(err, docs) {
            if (err) throw err 

            saving.update({ _id: "B" }, { _id: "B", updated: "yep" }, function(err, docs) {
              if (err) throw err 

              saving.update({ updated: "yep" }, { $set: { something: true } }, false, true, function(err, docs) {
                if (err) throw err 

                saving.find({ updated: "yep" }).count(function(err, count) {
                  if (err) throw err 
                  assert.equal(count, 2)
                })

                saving.find({ something: true }).count(function(err, count) {
                  if (err) throw err 
                  assert.equal(count, 2)
                })

                saving.remove({ something: true }, function(err) {
                  if (err) throw err 

                  saving.find().count(function(err, count) {
                    if (err) throw err 
                    assert.equal(count, 2)
                    // test inserting several

                    saving.insert([{ a: "E" }, { a: "F" }, { a: "G" }], function(err) {
                      if (err) throw err 

                      saving.find().count(function(err, count) {
                        if (err) throw err 
                        assert.equal(count, 5, "Inserting and count")
                        done()
                      })
                    })
                  })
                })
              })
            })
          })
        })
      })
    })
  })
})


describe("indexing", function() {
  it("should be able to ensure indexes", function(done) {
    var coll, db
    db = mongo.db("localhost", 27017, "test")
    db.collection('mongo.indexing')
    coll = db.mongo.indexing

    coll.drop(function(err) {
      if (err) throw err 
      // Test guaranteed ordering

      coll.insert({ _id: "A", property: 1, name: "bob" })
      coll.insert({ _id: "B", property: 2, name: "henry" })
      coll.insert({ _id: "C", property: 3, name: "bob" })

      coll.ensureIndex({ property: 1 }, function(err, name) {
        if (err) throw err 

        coll.find({ property: 2 }).explain(function(err, explanation) {
          if (err) throw err 
          assert.equal(explanation.nscanned, 1)

          coll.dropIndexes(function(err) {
            if (err) throw err 

            coll.find({ property: 2 }).explain(function(err, explanation) {
              if (err) throw err 
              assert.equal(explanation.nscanned, 3)
              done()
            })
          })
        })
      })
    })
  })
})


describe("nextAndInsert", function() {
  it("should be able to insert and then call next", function(done) {
    var db = mongo.db("localhost", 27017, "test")
    db.collection('mongo.next')

    db.mongo.next.drop(function(err) {
      assert.ifError(err)

      db.mongo.next.find().next(function(err) {
        assert.ifError

        db.mongo.next.insert([{ _id: "next" }, { _id: "next2" }], function(err) {

          db.mongo.next.count(function(err, count) {
            assert.ifError(err)
            assert.notEqual(count, 1, "Insert only saved one document")
            assert.equal(count, 2, "Insert saved unknown number " + count)

            db.mongo.next.find().next(function(err, doc) {
              assert.ifError(err)
              assert.ok(doc)

              db.mongo.next.find().limit(1).skip(1).next(function(err, doc) {
                assert.ifError(err)
                assert.ok(doc, "Missing second doc inserted")
                assert.equal(doc._id, "next2")
                done()
              })
            })
          })
        })
      })
    })
  })
})


describe("dropping", function() {
  it("should be able to drop the whole db", function(done) {
    var db = mongo.db("localhost", 27017, "test")
    db.collection('mongo.dropping')

    db.mongo.dropping.save({ _id: "woot" }, function(err) {
      assert.ifError(err)
    
      db.dropDatabase(function(err) {
        assert.ifError(err)
        done()
      })    
    })
  })
})



describe("reopen", function() {
  it("should be able to find a doc we save", function(done) {
    var db = mongo.db("localhost", 27017, "test")
    db.collection('mongo.reopen')

    db.mongo.reopen.save({ _id: "one" }, function(err, doc) {
      assert.ifError(err)

      db.mongo.reopen.find().toArray(function(err, docs) {
        assert.ifError(err)
        assert.ok(docs.length === 1, "Couldn't find doc in test reopen")
        done()
      })
    })
  })
})


describe("collections", function() {
  it("should be able to work with system collections", function() {
    var db = mongo.db('localhost', 27017, 'test')
    db.collection('system.indexes')
    assert.equal('system.indexes', db.system.indexes.name(), "Mongo didn't work with a compound name")
    assert.equal('test', db.name(), "Mongo renamed the databases name of the compound index")
  })
})


describe("objectId", function() {
  it("should expose an objectId to work with", function(done) {
    var db = mongo.db('localhost', 27017, 'test')
    db.collection('mongo.objectId')

    db.mongo.objectId.save({key:"value"}, function(err, doc) {
      assert.ifError(err)       
      
      // test to see if it passes the id through
      db.mongo.objectId.findOne({_id: doc._id}, function(err, doc) {
        assert.ifError(err)
        assert.ok(doc)                     
                                      
        // now re-construct it
        var stringId = doc._id.toString()          
        var objectId = new mongo.ObjectID(stringId)
        
        db.mongo.objectId.findOne({_id: objectId}, function(err, doc) {
          assert.ifError(err)
          assert.ok(doc)                     
          done()                                                                           
        })
      })
    })
  })
})     



describe("backgroundIndex", function() {
  it("should support background indexes", function(done) {
    var db = mongo.db('localhost', 27017, 'test')
    db.collection('mongo.bg')

    db.mongo.bg.save({one:"two"}, function(err, doc) {
      db.mongo.bg.ensureIndex({one: 1}, { background: true }, function(err) {
        assert.ifError(err) 

        var cursor = db.mongo.bg.find({one:"two"})
        cursor.explain(function(err, explanation) {
          assert.ifError(err)
          done()
        })
      })
    })
  })
})


// new tests with rewrite
//

function saveAndFind(coll, cb) {
  coll.save({test: "doc"}, function(err, doc) {
    assert.ifError(err)
    assert(doc)
    coll.findOne({}, function(err, ret) {
      assert.ifError(err)
      assert(ret)
      coll.drop(function(err) {
        assert.ifError(err)
        cb()
      })
    })
  })
}

describe("single collection name", function() {
  it("should support collects with a single name", function(done) {
    var db = mongo.db('localhost', 27017, 'test')
    db.collection('singleCollection')

    assert(db.singleCollection)
    saveAndFind(db.singleCollection, done)
  })
})

describe("conecting", function() {
  it("should support mongodb:// style connection strings - basic", function(done) {
    var db = mongo.db("mongodb://localhost/test")
    db.collection("connecting")
    saveAndFind(db.connecting, done)
  })

  it("should support a more fancy mongodb connection string, including auth", function(done) {
    var db = mongo.db("mongodb://localhost/test")
    db.addUser('user', 'pass', function(err) {
      assert.ifError(err)

      var db2 = mongo.db("mongodb://user:pass@localhost/test")
      db2.collection("authed")
      saveAndFind(db2.authed, done)
    })
  })
})

