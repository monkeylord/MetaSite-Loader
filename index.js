var ejs = require('ejs')
var CryptoJS = require("crypto-js")
var JSEncrypt = require('node-jsencrypt')
var fs = require('fs')
var bsv = require('bsv')
var crypto = require('crypto')
var fetch = require('node-fetch')

function Loader(opts){
  if (!(this instanceof Loader)) {
    return new Loader(opts)
  }
  this.siteId = opts.siteId
  this.rsakey = fs.readFileSync(opts.rsakey).toString()
  if(opts.sitemap){
      this.sitemap = JSON.parse(fs.readFileSync(opts.sitemap))
  }
  
}

Loader.prototype.getEntry = function(){
    var rsakey = this.rsakey
    var rsa = new JSEncrypt()
    rsa.setPrivateKey(rsakey)
    return ejs.renderFile(__dirname + '/templates/SingleTXEntrance.ejs',{PubK:rsa.getPublicKey().split('\n').join('\\n'),siteId:this.siteId}).then(file=>{
        //fs.writeFileSync('entrance.html',file)
        return file
    })
}

Loader.prototype.getSitemapRegistry = function(version){
    var registry = {}
    var rsa = new JSEncrypt()
    rsa.setPrivateKey(this.rsakey)
    var sitePubkey = rsa.getPublicKey()
    var sitemap = JSON.stringify(this.sitemap)

    var crypticPrefix = bsv.crypto.Hash.sha256(Buffer.from(sitePubkey+this.siteId)).toString('hex')
    //console.log(crypticPrefix)
    var sigstr = sign(this.rsakey, this.siteId+sitemap+version)
    //rsa.sign(this.siteId+sitemap+version, CryptoJS.SHA256)
    registry.crypticPrefix=crypticPrefix
    registry.sitemap=sitemap
    registry.sig=sigstr
    registry.version=version
    registry.sitePubkey = sitePubkey
    registry.siteId = this.siteId
    return registry
}

Loader.prototype.createScript = function(version) {
    var rsa = new JSEncrypt()
    rsa.setPrivateKey(this.rsakey)
    var sitePubkey = rsa.getPublicKey()
    var sitemap = JSON.stringify(this.sitemap)

    var crypticPrefix = bsv.crypto.Hash.sha256(Buffer.from(sitePubkey+this.siteId)).toString('hex')
    console.log(crypticPrefix)
    var sigstr = sign(this.rsakey, this.siteId+sitemap+version)
    //rsa.sign(this.siteId+sitemap+version, CryptoJS.SHA256)
    var script = bsv.Script.buildDataOut(crypticPrefix)
    script.add(bsv.deps.Buffer.from(sitemap))
    script.add(bsv.deps.Buffer.from(sigstr))
    script.add(bsv.deps.Buffer.from(version))

    return script
}

Loader.prototype.querySitemap = function(){
    var rsa = new JSEncrypt()
    rsa.setPrivateKey(this.rsakey)
    var sitePubkey = rsa.getPublicKey()
    var crypticPrefix = bsv.crypto.Hash.sha256(Buffer.from(sitePubkey+this.siteId)).toString('hex')
    var query = {
        "v": 3,
        "q": {
          "find": { "out.s1": crypticPrefix}
        },
        "r": {
          "f": "[ .[] | {sitemap: .out[0].ls2, sitemap_short: .out[0].s2, sig: .out[0].s3, version: .out[0].s4, blk:.blk.i} ]"
        }
    }
    var b64 = Buffer.from(JSON.stringify(query)).toString('base64')
    var url = "https://genesis.bitdb.network/q/1FnauZ9aUH2Bex6JzdcV4eNX7oLSSEbxtN/" + b64
    var header = {headers: { key: "18toxD9NQ3DcgzQ9nP8ZhhhgioARJdwiKn" }}
    return fetch(url, header).then(r=>r.json()).then(r=>{
        r.c = r.c.concat(r.u)
        r.c.forEach(map=>map.sitemap=map.sitemap || map.sitemap_short)
        maps=r.c
        var sitemaps=maps
        .sort((a,b)=>b.blk-a.blk)
        .sort((a,b)=>b.version-a.version)
        //.filter((entry)=>verify(sitePubkey, this.siteId + entry.sitemap + ((entry.version!=null) ? entry.version : ""), entry.sig))
        if(sitemaps.length>0){
            console.log("Latest Sitemap Version:"+sitemaps[0].version)
        }
        return sitemaps
    })
}

function sign(key,data){
    var sign = crypto.createSign('RSA-SHA256');
    sign.update(data);
    sig = sign.sign(key, 'base64');
    return sig;
}

function verify(pub,data,sig){
    var verify = crypto.createVerify('RSA-SHA256');
    verify.update(data);
    return verify.verify(pub, sig, 'base64')
}

module.exports = Loader