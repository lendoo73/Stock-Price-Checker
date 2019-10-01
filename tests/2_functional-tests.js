/*
*
*
*       FILL IN EACH FUNCTIONAL TEST BELOW COMPLETELY
*       -----[Keep the tests in the same order!]-----
*       (if additional are added, keep them at the very end!)
*/

var chaiHttp = require('chai-http');
var chai = require('chai');
var assert = chai.assert;
var server = require('../server');

chai.use(chaiHttp);

suite('Functional Tests', function() {
    
    suite('GET /api/stock-prices => stockdata object', function() {
      
      test('1 stock', function(done) {
        chai.request(server)
          .get('/api/stock-prices')
          .query({stock: 'goog'})
          .end(function(err, res){
            assert.equal(res.status, 200);
            assert.property(res.body, "stockdata");
            assert.property(res.body.stockdata, "stock");
            assert.property(res.body.stockdata, "price");
            assert.property(res.body.stockdata, "likes");
            assert.equal(res.body.stockdata.stock, "GOOG");
            //complete this one too
            done();
          })
        ;
      });
      
      let testLikes;
      test('1 stock with like', function(done) {
        chai.request(server)
          .get("/api/stock-prices")
          .query({stock: "goog", like:true})
          .end((err, res) => {
            assert.equal(res.status, 200);
            assert.property(res.body, "stockdata");
            assert.property(res.body.stockdata, "stock");
            assert.property(res.body.stockdata, "price");
            assert.property(res.body.stockdata, "likes");
            assert.equal(res.body.stockdata.stock, "GOOG");
            assert.isAbove(res.body.stockdata.likes, 0);
            testLikes = res.body.stockdata.likes;
            done();
          })
        ;
      });
      
      test('1 stock with like again (ensure likes arent double counted)', function(done) {
        chai.request(server)
          .get("/api/stock-prices")
          .query({stock: "goog", like:true})
          .end((err, res) => {
            assert.equal(res.status, 200);
            assert.property(res.body, "stockdata");
            assert.property(res.body.stockdata, "stock");
            assert.property(res.body.stockdata, "price");
            assert.property(res.body.stockdata, "likes");
            assert.equal(res.body.stockdata.stock, "GOOG");
            assert.equal(res.body.stockdata.likes, testLikes);
            done();
          })
        ;
      });
      
      let testRelLikes;
      test('2 stocks', function(done) {
        chai.request(server)
          .get("/api/stock-prices")
          .query({stock: ["goog", "msft"]})
          .end((err, res) => {
            assert.equal(res.status, 200);
            assert.isArray(res.body.stockdata);
            assert.property(res.body.stockdata[0], "stock");
            assert.property(res.body.stockdata[0], "price");
            assert.property(res.body.stockdata[0], "rel_likes");
            assert.property(res.body.stockdata[1], "stock");
            assert.property(res.body.stockdata[1], "price");
            assert.property(res.body.stockdata[1], "rel_likes");
            assert.oneOf(res.body.stockdata[0].stock, ["GOOG", "MSFT"]);
            assert.oneOf(res.body.stockdata[1].stock, ["GOOG", "MSFT"]);
            assert.equal(res.body.stockdata[0].rel_likes + res.body.stockdata[1].rel_likes, 0);
            testRelLikes = Math.abs(res.body.stockdata[0].rel_likes);
            done();
          })
        ;
      });
      
      test('2 stocks with like', function(done) {
        chai.request(server)
          .get("/api/stock-prices")
          .query({stock: ["goog","msft"], like:true})
          .end((err, res) => {
            assert.equal(res.status, 200);
            assert.oneOf(res.body.stockdata[0].stock, ["GOOG", "MSFT"]);
            assert.oneOf(res.body.stockdata[1].stock, ["GOOG", "MSFT"]);
            assert.equal(res.body.stockdata[0].rel_likes + res.body.stockdata[1].rel_likes, 0);
            assert.equal(Math.abs(res.body.stockdata[0].rel_likes), testRelLikes);
            done();
          })
        ;
      });
    });
});
