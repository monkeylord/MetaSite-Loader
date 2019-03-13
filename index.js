var ejs = require('ejs')
var JSEncrypt = require('node-jsencrypt')

function Loader(opts){
  if (!(this instanceof Loader)) {
    return new Loader(opts)
  }
  this.siteId = opts.siteId
  this.rsakey = opts.rsakey
}

Loader.prototype.getEntry = function(){
    var rsakey = fs.readFileSync(this.rsakey).toString()
    var rsa = new JSEncrypt()
    rsa.setPrivateKey(rsakey)
    ejs.renderFile('./templates/SingleTXEntrance.ejs',{PubK:rsa.getPublicKey().split('\n').join('\\n'),siteId:this.siteId}).then(file=>{
        fs.writeFileSync('entrance.html',file)
    })
}

module.exports = Loader