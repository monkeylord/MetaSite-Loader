/*
MIT License

Copyright (c) 2019 monkeylord

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

function SiteLoader(siteInfo){
    if(!JSEncrypt||!CryptoJS)throw new Error("Load JSEncrypt and CryptoJS first")
    if(!siteInfo.sitePubK || !siteInfo.siteId)throw new Error("sitePubK and siteId are required")
    if (!(this instanceof SiteLoader)) {
        return new SiteLoader(siteInfo)
    }
    this.sitemap = null
    this.inited = false
    this.siteInfo = siteInfo
    this.rsa = new JSEncrypt()
    this.rsa.setPublicKey(siteInfo.sitePubK)
    this.endpoint = siteInfo.endpoint || "https://bitgraph.network/q/"
    this.apikey = siteInfo.apikey || "1NivvRMuW2UPmYXQg5JFaR8QjMPLasGVxA"
    this.index = siteInfo.index || "index.html"
    this.httpGateway = siteInfo.httpGateway || ""
    this.crypticPrefix = CryptoJS.SHA256(this.siteInfo.sitePubK + this.siteInfo.siteId).toString()
    this.buildQuery()
    this.initSitemap()
    return this
}

SiteLoader.prototype.hResponse = function (scriptTX){
    if (!scriptTX) return new Response("TX is missing", {status: 500})
    if (scriptTX instanceof Array) {
        return Promise.all(scriptTX.map(tx=>fetch(this.httpGateway + tx))).then(rsps=>{
            if(!rsps.every(rsp=>rsp.status==200))throw new Error("not all chunks succuss")
            var headers = rsps[0].headers
            return Promise.all(rsps.map(rsp=>rsp.blob()))
                    .then(blobs=>new Response(new Blob(blobs,{type:blobs[0].type}), {headers : headers}))
        }).catch(err=>new Response(err, {status: 500}))
    }
    else {
        return fetch(this.httpGateway + scriptTX)
    }
}

SiteLoader.prototype.bResponse = function (scriptTX){
    // TODO: Fetch Data from BitDB
}

SiteLoader.prototype.buildQuery = function (){
    // Known Issue: BitDB s2 / ls2
    // Sitemap size must > 500
    this.query = {
        "v": 3,
        "q": {
          "find": { "out.s1": this.crypticPrefix}
        },
        "r": {
          "f": "[ .[] | {sitemap: .out[0].ls2, sitemap_short: .out[0].s2, sig: .out[0].s3, version: .out[0].s4, blk:.blk.i} ]"
        }
    }
}

SiteLoader.prototype.initSitemap = function (){
    console.log("Updating Sitemap")
    var b64 = btoa(JSON.stringify(this.query))
    var url = this.endpoint + b64
    var header = {headers: { key: this.apikey }}
    fetch(url, header).then(r=>r.json()).then(r=>{
        r.c = r.c.concat(r.u)
        r.c.forEach(map=>map.sitemap=map.sitemap || map.sitemap_short)
        var trustedSitemaps=r.c.sort((a,b)=>b.blk-a.blk).sort((a,b)=>b.version-a.version).filter((entry)=>this.verifySig(this.siteInfo.siteId + entry.sitemap + ((entry.version!=null) ? entry.version : ""),entry.sig))
        if(trustedSitemaps.length>0){
            console.log("Latest Sitemap Version:"+trustedSitemaps[0].version)
            this.sitemap = JSON.parse(trustedSitemaps[0].sitemap)
            this.inited = true
        }
    })
}

SiteLoader.prototype.verifySig = function(url,sig){
    try{
        return this.rsa.verify(url, sig, CryptoJS.SHA256)
    }catch(err){
        return false
    }
}
SiteLoader.prototype.fetch = function(event){
  if(!this.inited){
      this.initSitemap()
      event.respondWith(new Response("SiteLoader is loading latest sitemap, please wait for a few seconds.<script>setTimeout('location.reload()',3000)</script>", {status: 500, headers:{"Content-Type":"text/html;charset=utf-8"}}))
      return
  }
  var url = decodeURI(event.request.url.replace(event.target.registration.scope,""))
  // Do not handle any parameters in url
  url = url.split('?')[0]
  if(url == "")this.initSitemap()
  console.log('SiteLoader: Handling Fetch:' + url)
  
  var scriptTX=this.sitemap.urls[url]
  if(scriptTX == undefined)scriptTX=this.sitemap.urls[url+((url.endsWith('/'))?"":'/')+this.index]
  if (scriptTX != undefined) {
    // return event.respondWith(new Response(scriptTX, {status: 500}))
    // bResponse(event, scriptTX)
    console.log("TXID:"+scriptTX)
    event.respondWith(this.hResponse(scriptTX))
  }
}
SiteLoader.prototype.setEndpoint = function(endpoint){
    this.endpoint=endpoint
}
