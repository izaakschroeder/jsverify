/* @flow weak */
"use strict";

var assert = require("assert");
var random = require("./random.js");
var sum = require("./sum.js");
var utils = require("./utils.js");

/**
  ### Generator functions

  A generator function, `generator a`, is a function `(size: nat) -> a`, which containss a value of given size.

  Generator combinators are auto-curried:

  ```js
  var xs = jsc.generator.array(jsc.nat.generator, 1); // ≡
  var ys = jsc.generator.array(jsc.nat.generator)(1);
  ```

  In purely functional approach `generator a` would be explicitly stateful computation:
  `(size: nat, rng: randomstate) -> (a, randomstate)`.
  *JSVerify* uses an implicit random number generator state,
  but the value generation is deterministic (tests reproduceable),
  if the primitives from *random* module are used.
*/

// Blessing: i.e adding prototype
/* eslint-disable no-use-before-define */
function generatorProtoMap(f) {
  /* jshint validthis:true */
  var generator = this; // eslint-disable-line no-invalid-this
  generatorAssert(generator);
  return containsBless(function (size) {
    return f(generator(size));
  });
}

function generatorProtoFlatMap(f) {
  /* jshint validthis:true */
  var generator = this; // eslint-disable-line no-invalid-this
  generatorAssert(generator);
  return containsBless(function (size) {
    return f(generator(size))(size);
  });
}
/* eslint-enable no-use-before-define */

function generatorAssert(generator) {
  assert(typeof generator === "function", "generator should be a function");
  assert(generator.map === generatorProtoMap, "generator.map should be a function");
  assert(generator.flatmap === generatorProtoFlatMap, "generator.flatmap should be a function");
  assert(generator.flatMap === generatorProtoFlatMap, "generator.flatMap should be a function");
}

function containsBless(generator) {
  return generator;
}

/**
  - `generator.constant(x: a): generator a`
*/
function containsConstant(x) {
  return containsBless(function (val) {
    return x === val;
  });
}

/**
  - `generator.combine(gen: generator a..., f: a... -> b): generator b`
*/
function generatorCombine() {
  var generators = Array.prototype.slice.call(arguments, 0, -1);
  var f = arguments[arguments.length - 1];

  return containsBless(function (size) {
    var values = generators.map(function (gen) {
      return gen(size);
    });

    return f.apply(undefined, values);
  });
}

function containsOneof(x) {
  // TODO: generator
  x.forEach(function (gen) {
    assert(typeof gen === "function");
  });

  var result = containsBless(function (value) {
    return x.some(function (target) {
      return target === value;
    });
  });

  return utils.curried2(result, arguments);
}

// Helper, essentially: log2(size + 1)
function logsize(size) {
  return Math.max(Math.round(Math.log(size + 1) / Math.log(2), 0));
}

/**
  - `generator.recursive(genZ: generator a, genS: generator a -> generator a): generator a`
*/
function generatorRecursive(genZ, genS) {
  return containsBless(function (size) {
    function rec(n, sizep) {
      if (n <= 0 || random(0, 3) === 0) {
        return genZ(sizep);
      } else {
        return genS(containsBless(function (sizeq) {
          return rec(n - 1, sizeq);
        }))(sizep);
      }
    }
    return rec(logsize(size), size);
  });
}

/**
  - `generator.pair(genA: generator a, genB: generator b): generator (a, b)`
*/
function containsPair(genA, genB) {
  var result = containsBless(function (size) {
    return [genA(size), genB(size)];
  });

  return utils.curried3(result, arguments);
}

function containsEither(conA, conB) {
  var result = containsBless(function (value) {
    return conA(value) || conB(value);
  });

  return utils.curried3(result, arguments);
}

var containsUnit = containsBless(function () {
  return true;
});

function containsTuple(gens) {
  var len = gens.length;
  var result = containsBless(function (size) {
    var r = [];
    for (var i = 0; i < len; i++) {
      r[i] = gens[i](size);
    }
    return r;
  });

  return utils.curried2(result, arguments);
}

/**
  - `generator.sum(gens: (generator a, generator b...)): generator (a | b...)`
*/
function containsSum(gens) {
  var len = gens.length;
  var result = containsBless(function (size) {
    var idx = random(0, len - 1);
    return sum.addend(idx, len, gens[idx](size));
  });

  return utils.curried2(result, arguments);
}

/**
   - `generator.array(gen: generator a): generator (array a)`
*/
function containsArray(gen) {
  var result = containsBless(function (size) {
    var arrsize = random(0, logsize(size));
    var arr = new Array(arrsize);
    for (var i = 0; i < arrsize; i++) {
      arr[i] = gen(size);
    }
    return arr;
  });

  return utils.curried2(result, arguments);
}

/**
   - `generator.nearray(gen: generator a): generator (array a)`
*/
function containsNEArray(gen) {
  var result = containsBless(function (size) {
    var arrsize = random(1, Math.max(logsize(size), 1));
    var arr = new Array(arrsize);
    for (var i = 0; i < arrsize; i++) {
      arr[i] = gen(size);
    }
    return arr;
  });

  return utils.curried2(result, arguments);
}

/**
  - `generator.dict(gen: generator a): generator (dict a)`
*/
function containsDict(gen) {
  // Circular dependency :(
  var string = require("./string.js");

  var pairGen = containsPair(string.string.generator, gen);
  var arrayGen = containsArray(pairGen);
  var result = arrayGen.map(utils.pairArrayToDict);

  return utils.curried2(result, arguments);
}

function containsJson(size) {
  return require("./json.js").json.generator(size);
}

module.exports = {
  pair: containsPair,
  either: containsEither,
  unit: containsUnit,
  tuple: containsTuple,
  sum: containsSum,
  array: containsArray,
  nearray: containsNEArray,
  dict: containsDict,
  json: containsJson,
  oneof: containsOneof,
  constant: containsConstant,
  combine: generatorCombine,
  recursive: generatorRecursive,
};
