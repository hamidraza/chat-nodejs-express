
module.exports = (naturalMongoSyntax) ->

  sort = []
  for field, orderNum of naturalMongoSyntax
    sort.push [field, orderNum]

  return sort
