# MetaSite-Loader
A Service Worker based Siteloader for metanet website. Enable multi files website.

### What can you do with Metasite-Loader

1. build a on-chain website that contains multiple files.
2. build pages with relative url reference instead of tx.
3. separate UI design from on-chain adaption.
4. update website content without changing TX entrace.

### Example

[My multi-page on-chain blog](https://bico.media/579c7ece7d118469254035e53a11ff7ab4c64e0f0aa4bb7f65151fe63ea42018).

It contains 28 individual files. See [sitemap](https://bitgraph.network/explorer/ewogICJ2IjogMywKICAicSI6IHsKICAgICJmaW5kIjogeyJvdXQuaDEiOiI2NDMxMzUzMTMyMzAzMzM5MzczNTM5MzUzODM2MzAzMDYyNjEzMTMzMzYzMTM2NjI2MjYxMzczMTM4Mzc2NDM5NjYzODY1NjUzMzY0MzE2NDMwMzk2MTM4NjUzNjM1NjUzODM2Mzk2MjYyNjYzNDYzNjYzMzY2NjU2MTYyNjUzNiJ9LAogICAgImxpbWl0IjogMTAKICB9LAogICJyIjogewogICAgImYiOiAiWyAuW10gfCB7c2l0ZW1hcDogLm91dFswXS5sczIsIHNpZzogLm91dFswXS5zMywgdmVyc2lvbjogLm91dFswXS5zNCwgYmxrOi5ibGsuaX0gXSIKICB9Cn0=) it use.

### How does it work?

Siteloader.js is a packaged service worker.

When registered on browser, it plays as proxy within the same origin, which allow it map url request to TX.

It follows latest sitemap that download from BitDB to map requests.

Sitemap example:

~~~json
{
    "index.html": TXID,
    "js/app.js":[
        Chunk1TXID,
        Chunk2TXIO
    ]
}
~~~

The reason why I choose RSA instead of ECDSA on secp256k1 is because JSEncrypt is light weight, which is friendly for first loading.

### How can I use it.

You should register siteloader as service worker on your entrance page.

Normally 2 files are needed for a entrance : `index.html` and `serviceworker.js`

In `index.html`:

~~~html
<html>
<head>
<script>
// Should register in subdomain
var mypath = document.location.pathname
if(mypath.endsWith('/')){
    mypath=mypath.slice(0,mypath.length-1)
    if(!navigator.serviceWorker.controller||!navigator.serviceWorker.controller.state=='activated'){
        navigator.serviceWorker.register("serviceworker.js", {scope: mypath+"/"})
        // wait and refresh
        setTimeout("document.location.href = mypath+'/'",2000)
    }else{
        index()
    }
}else{
    navigator.serviceWorker.register(mypath+".js", {scope: mypath+"/"})
    // wait and refresh
    setTimeout("document.location.href = mypath+'/'",2000)
}
function index(){
    console.log("Good!")
    document.location.href="./index.html"
}
</script>
</head>
<body>
Loading...
</body>
</html>
~~~

In `serviceworker.js`:

~~~javascript
window=this
// JSEncrypt.js on-chain
importScripts('c1ac4721b5029b5d879e76720182c346838c1a6a139f99bd01538e7c7e780501')
// CryptoJS.js on-chain
importScripts('1b1ba5c0dece7a642c9a16a6c7bc73e62ebf595e2fa956bf09cdf4aff0660d01')
// SiteLoader.js on-chain
importScripts('78fb218a76e0b09f99e277fb9a23c3f25dda656fe83a9d5049dbf369dff8e0ae')

var PubK =  '-----BEGIN PUBLIC KEY-----\n'+
            'MIIBITANBgkqhkiG9w0BAQEFAAOCAQ4AMIIBCQKCAQBwqamPZSSWfU2mVNsY4Ptv\n'+
            'vVAv6PUN5U1J7TVzz9urpM98ABkF04VdBkr5GpgVL7DjUYp4BUdB8ymTGoc9GDHG\n'+
            'dplBbmdtRiRZinnVJNs5+d6cXhdH5of68TpxtHjxMlA5/gj3yJY0eI/WNd8MP+m/\n'+
            '6gfyC4b0UcnlvQCC7VMK3z21BCIVgsRsoruIYdrd1O74mOsL9LoxX+/uprAqv2/O\n'+
            'fT1rH0eHM9SKftcmyZxJT0l0PaOxGQrg5H/LA7OouQUoa8L3XacFSK7F2OffxAFr\n'+
            'VH+9EWNJl52FAO5Gw1J+tXHpyuNusRXu1V8IoNyFBt4j2bkwrBPFzVxr39aJk0PB\n'+
            'AgMBAAE=\n'+
            '-----END PUBLIC KEY-----'

var mSiteloader = new SiteLoader({
    sitePubK : PubK,
    siteId : "Blog",
    endpoint : "https://bitgraph.network/q/",
    apikey : "1NivvRMuW2UPmYXQg5JFaR8QjMPLasGVxA"
})

self.addEventListener('fetch', function(event) {
    mSiteloader.fetch(event)
});
~~~

### How can I build/broadcast sitemap

#### Build sitemap

Sitemap is an json object that use URL as key, TXID as value.

File should follow [B protocol](https://github.com/unwriter/B).

~~~json
{
    "FileURL1": "5ff1c5b638651a7673f3164de4fa25fbffef6f5078f37e0281a9d8bb592a2944",
    "FileURL2": "b25e471a28b3d8aed96ee7d841e10e7e3db2695a796292b73809ae69686bc700",
    "MultiChunkFileURL":[
        "72e5ee805b99b1837745b043c27db0d8cd4f5ffeda4035623ab17b0e04190a68",
        "880fc7a0588f3d484756c9b0e81dc06f3a3368afa6736a13f826c00c299bc390"
    ]
}
~~~

#### Broadcast sitemap

##### The protocol

Sitemap protocol is a OP_RETURN protocol.

It is built as

> OP_RETURN <Identifier> <Sitemap> <signature> <version>

`Identifier`(or CrypticPrefix) is generated from SiteId and Public key, which create unique prefix for each site.

> Identifier = SHA256 ( PublicKey + SiteId )

`Version` is the version of sitemap, which is a number. SIteloader will load latest version, if version field is not set, siteloader will load the newest(judged by block height) sitemap. 

`signature` is RSA signature on `SiteId`+`Sitemap`+`version`, which protect sitemap from attacks.

##### The broadcaster

You need not to build sitemap OP_RETURN by yourself.

You can use `SitemapBroadcaster.html`, a tool built to update sitemap for metasites.

#### RSA Key pair

> openssl genrsa -out rsa_private_key.pem 2048
>
> openssl rsa -in rsa_private_key.pem -pubout -out rsa_public_key.pem



