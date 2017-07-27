var loopback = require('loopback');
var boot = require('loopback-boot');
var path = require('path');
var mustache = require('mustache');
var fs = require('fs');
var hash = require('object-hash');
var async = require('async');
require('compression');
var app = module.exports = loopback();

app.start = function() {

  app.defineCollectionID = function(language, institutionCode, collectionCode) {
    collectionCode = (typeof collectionCode == 'undefined')?'':String(collectionCode).trim();
    institutionCode = (typeof institutionCode == 'undefined')?'':String(institutionCode).trim();
    if(language && language.trim().length>0 && institutionCode.trim().length>0 && collectionCode.trim().length>0)
      return language.trim().concat(":").concat(institutionCode.trim()).concat(":").concat(collectionCode.trim());
    else
      return null;
  }
  app.defineSchemaID = function(language, schema, class_, term) {
    schema = (typeof schema == 'undefined')?'':String(schema).trim();
    class_ = (typeof class_ == 'undefined')?'':String(class_).trim();
    term = (typeof term == 'undefined')?'':String(term).trim();
    if(language && language.trim().length>0 && schema.trim().length>0 && class_.trim().length>0 && term.trim().length>0)
      return language.trim().concat(":").concat(schema.trim()).concat(":").concat(class_.trim()).concat(":").concat(term.trim());
    else
      return null;
  }
  app.defineSpecimenID = function(language, institutionCode, collectionCode, catalogNumber) {
    catalogNumber = (typeof catalogNumber == 'undefined')?'':String(catalogNumber).trim();
    collectionCode = (typeof collectionCode == 'undefined')?'':String(collectionCode).trim();
    institutionCode = (typeof institutionCode == 'undefined')?'':String(institutionCode).trim();
    if(language && language.trim().length>0 && institutionCode.trim().length>0 && collectionCode.trim().length>0 && catalogNumber.trim().length>0)
      return language.trim().concat(":").concat(institutionCode.trim()).concat(":").concat(collectionCode.trim()).concat(":").concat(catalogNumber.trim());
    else
      return null;
  }
  app.defineSpeciesID = function(language, base, scientificName) {
    scientificName = (typeof scientificName == 'undefined')?'':String(scientificName).trim();
    if(language && language.trim().length>0 && scientificName.trim().length>0 && base)
      return language.trim().concat(":").concat(base.trim()).concat(":").concat(scientificName.trim());
    else
      return null;
  }
  // start the web server
  return app.listen(function() {
    app.emit('started');
    var baseUrl = app.get('url').replace(/\/$/, '');
    console.log('Web server listening at: %s', baseUrl);
    if (app.get('loopback-component-explorer')) {
      var explorerPath = app.get('loopback-component-explorer').mountPath;
      console.log('Browse your REST API at %s%s', baseUrl, explorerPath);
    }
  });
};
// app.use(loopback.compress());
app.use(loopback.static(path.resolve(__dirname, '../client-bigno')));

// Aqui (para a chave) vai ter que ser diferente porque a quantidade de parâmetros é variável. Vai ter que usar os parametros do tipo ?parmA=X&paramB=Y
app.get('/', function(req, res) {  
  res.redirect("/bigno");
});

app.get('', function(req, res) {  
  res.redirect("/bigno");
});

app.get('/eco', function(req, res) {
  var template = fs.readFileSync('./client-bigno/index.mustache', 'utf8');
  // var partials = {
  //   item: fs.readFileSync('./client/item_partial.mustache', 'utf8')
  // };
  // var params = {query: req.query};
  var params = {base: "eco"}; //mudar para bigno
  res.send(mustache.render(template, params));
});

app.get('/taxon', function(req, res) {
  var template = fs.readFileSync('./client-bigno/index.mustache', 'utf8');
  // var partials = {
  //   item: fs.readFileSync('./client/item_partial.mustache', 'utf8')
  // };
  // var params = {query: req.query};
  var params = {base: "taxon"};
  res.send(mustache.render(template, params));
});

app.get('/bigno', function(req, res){
  var template = fs.readFileSync('./client-bigno/index.mustache', 'utf8');
  var params = {base:"bigno"};
  res.send(mustache.render(template, params))

});

// Repetir para os outros profiles
app.get('/profile/species/:base/:id', function(req, res) {
  var template = fs.readFileSync('./client-bigno/species.mustache', 'utf8');
  var params = {id: req.params.id,base: req.params.base?req.params.base:"bigno"};

  res.send(mustache.render(template, params));
});

//Pagina de especime 
app.get('/profile/specimen/:base/:id', function(req, res) {
  var Specimen = app.models.Specimen;
  var params = {};
  params.id =req.params.id; //id da specimen
  params.language = req.params.id.split(":")[0]; //linguagem
  params.value = {}; //valor
  async.parallel([
    function(callback) {
      siteLabel(params,callback); //parametros de siteLabel
    },
    function (callback) {
      profilesLabel(params,callback); //parametros profilesLabel
    },
    function(callback) {
      var parsedId = params.id.split(":");
      collection([parsedId[0],parsedId[1],parsedId[2]].join(":"),params,callback);      //verificar 
    },
    function specimen(callback) {
      Specimen.findById(params.id,function(err,specimen) {
        Object.keys(specimen.toJSON()).forEach(function(key) {
          var parsedId = key.split(":");
          if(parsedId.length){
            var domIdLabel = parsedId[1]+":"+parsedId[2]+":"+parsedId[3]+":label";
            var domIdValue = parsedId[1]+":"+parsedId[2]+":"+parsedId[3]+":value";
            if(specimen[key].field)
              params.label[domIdLabel] = specimen[key].field+": ";
            if(specimen[key].value && !specimen[key].states && !specimen[key].months){
              // NORMAL VALUE
              params.value[domIdValue] = specimen[key].value;              
              // COORDINATES
              if(parsedId[3]=="decimalLatitude" || parsedId[3]=="decimalLongitude")
                params.value[domIdValue] = specimen[key] && specimen[key].value && Number(specimen[key].value)!="NaN"?Number(specimen[key].value).toFixed(5):""
              // IMAGE
              if(parsedId[2]=="Image"){
                params.value[domIdValue] = [];
                specimen[key].images.forEach(function(image){
                 params.value[domIdValue].push({value:image.resized});
                });
              }
              // REFERENCES
              if(parsedId[2]=="Reference"){
                params.value[domIdValue] = [];
                specimen[key].value.split("|").forEach(function(referencia){
                 params.value[domIdValue].push({value:referencia});
                });
              }
            } else if(specimen[key].states){
              // NORMAL CATEGORICAL DESCRIPTOR
              params.value[domIdValue] = "";
              specimen[key].states.forEach(function(state) {
                params.value[domIdValue] += state.state+", ";
              });
              params.value[domIdValue] = params.value[domIdValue].substring(0,params.value[domIdValue].length-2)

              // POLLEN SIZE
              if(specimen[key].term=="pollenSize"){
                if(specimen[key].states.length==1){
                  params.value[domIdValue] = specimen[key].states[0].state;
                } else {            
                  var order = ["pollenSizeVerySmall","pollenSizeSmall","pollenSizeMedium","pollenSizeLarge","pollenSizeVeryLarge","pollenSizeGiant"];
                  var lowestIndex = Infinity;
                  var highestIndex = -1;                        
                  var lowestValue = "?";
                  var highestValue = "?";                        
                  specimen[key].states.forEach(function(state) {              
                      var position  = order.indexOf(state.term);
                      if(position < lowestIndex) {
                        lowestIndex = position;
                        lowestValue = state.state;
                      }
                      if(position > highestIndex) {
                        highestIndex = position;
                        highestValue = state.state;
                      }
                  });
                  var sep = specimen.language=='en-US'?' to ':' a ';
                  params.value[domIdValue] = lowestValue+sep+highestValue;
                } 
              }
              // POLLEN SHAPE
              if(specimen[key].term=="pollenShape"){
                if(specimen[key].states.length==1){
                  params.value[domIdValue] = specimen[key].states[0].state;
                } else {            
                  var order = ["pollenShapePeroblate","pollenShapeOblate","pollenShapeSuboblate","pollenShapeOblateSpheroidal","pollenShapeSpheroidal","pollenShapeProlateSpheroidal","pollenShapeSubprolate", "pollenShapeProlate", "pollenShapePerprolate"];
                  var lowestIndex = Infinity;
                  var highestIndex = -1;                        
                  var lowestValue = "?";
                  var highestValue = "?";                        
                  specimen[key].states.forEach(function(state) {              
                      var position  = order.indexOf(state.term);
                      if(position < lowestIndex) {
                        lowestIndex = position;
                        lowestValue = state.state;
                      }
                      if(position > highestIndex) {
                        highestIndex = position;
                        highestValue = state.state;
                      }
                  });
                  var sep = specimen.language=='en-US'?' to ':' a ';
                  params.value[domIdValue] = lowestValue+sep+highestValue;
                } 
              }
              // FLOWER SIZE
              if(specimen[key].term=="flowerSize"){
                if(specimen[key].states.length==1){
                  params.value[domIdValue] = specimen[key].states[0].state;
                } else {            
                  var order = ["flowerSizeVerySmall","flowerSizeSmall","flowerSizeMedium","flowerSizeLarge","flowerSizeVeryLarge"];
                  var lowestIndex = Infinity;
                  var highestIndex = -1;                        
                  var lowestValue = "?";
                  var highestValue = "?";                        
                  specimen[key].states.forEach(function(state) {              
                      var position  = order.indexOf(state.term);
                      if(position < lowestIndex) {
                        lowestIndex = position;
                        lowestValue = state.state;
                      }
                      if(position > highestIndex) {
                        highestIndex = position;
                        highestValue = state.state;
                      }
                  });
                  var sep = specimen.language=='en-US'?' to ':' a ';
                  params.value[domIdValue] = lowestValue+sep+highestValue;
                } 
              }
            } else if(specimen[key].months){
              params.value[domIdValue] = "";
              specimen[key].months.forEach(function(month) {
                params.value[domIdValue] += month+", ";
              });
              params.value[domIdValue] = params.value[domIdValue].substring(0,params.value[domIdValue].length-2)
            } else if(specimen[key]["class"] == "NumericalDescriptor"){
              params.value[domIdValue] = params.value[domIdValue].substring(0,params.value[domIdValue].length-2)
            }
          }
        });
        callback();
      });
    }
  ],function done() {
    var template = fs.readFileSync('./client-bigno/specimen.mustache', 'utf8');
    params.base = req.params.base?req.params.base:"bigno"; //mudar para bigno
    res.send(mustache.render(template, params));
  });
});

app.get('/quality/check', function(req, res) {
  var template = fs.readFileSync('./client-bigno/quality.mustache', 'utf8');
  var params = {base: "bigno"}; 

  res.send(mustache.render(template, params));
});

//Informações da palinoteca
app.get('/profile/palinoteca/:base/:id', function(req, res) {
  var params = {base: req.params.base?req.params.base:"bigno"};
  params.id =req.params.id;
  params.language = req.params.id.split(":")[0];
  params.value = {};
  async.parallel([
    function(callback) {
      siteLabel(params,callback);
    },
    function (callback) {
      profilesLabel(params,callback);
    },
    function(callback) {
      collection(params.id,params,callback);
    },
    function(callback) {
      profilesDwc(params,callback);
    },
  ],function done() {
    var template = fs.readFileSync('./client-bigno/palinoteca.mustache', 'utf8');
    res.send(mustache.render(template, params));
  });
});

//Informação de coleções
function collection(id, params, callback) {
  params.value = params.value?params.value:{};
  var Collection = app.models.Collection;
  Collection.findById(id,function(err,collection) {
    Object.keys(collection.toJSON()).forEach(function(key) {
      var parsedId = key.split(":");
      if(parsedId.length){
        var domIdLabel = parsedId[1]+":"+parsedId[2]+":"+parsedId[3]+":label";
        var domIdValue = parsedId[1]+":"+parsedId[2]+":"+parsedId[3]+":value";
        if(collection[key].field && collection[key].value)
          params.label[domIdLabel] = collection[key].field;
        if(collection[key].value){
          params.value[domIdValue] = collection[key].value;
          if(parsedId[2]=="Image"){
            if(collection[key].value && collection[key].value.length>0)
              params.value[domIdValue] = collection[key].value.replace("https://drive.google.com/open?id=","https://docs.google.com/uc?id=");
            else
              params.value[domIdValue] = "/img/lspm.jpg";
          }
        }
      }
    });
    callback();
  });
}

//Leitura dos siteLabel
function siteLabel(params,callback) {
  params.label = params.label?params.label:{};
  var Schema = app.models.Schema;
  Schema.find({where:{"class":"SiteLabel",language:params.language}},function(err,siteLabel) {
    siteLabel.forEach(function(item) {      
      var parsedId = item.id.split(":");
      var domId = parsedId[1]+":"+parsedId[2]+":"+parsedId[3];      
      if(domId=="bigno:SiteLabel:citation"){
        var field = item.field;
        var formattedDate = "";
        var date = new Date();
        var day = date.getDate();
        var monthIndex = date.getMonth();
        var year = date.getFullYear();
        if(parsedId[0]=="en-US"){
          formattedDate = monthIndex+"/"+day+"/"+year;
        } else formattedDate = day+"/"+monthIndex+"/"+year;
        field = field+" "+formattedDate;
        params.label[domId] = field;
      } else params.label[domId] = item.field;
    });
    callback();
  });
}

//Leitura dos profilesDwc
function profilesDwc(params,callback) {
  params.label = params.label?params.label:{};
  var Schema = app.models.Schema;
  Schema.find({where:{"schema":"dwc",language:params.language}},function(err,profilesLabel) {
    profilesLabel.forEach(function(item) {
      var parsedId = item.id.split(":");
      var domId = parsedId[1]+":"+parsedId[2]+":"+parsedId[3]
      params.label[domId] = item.field;          
    });
    callback();
  });
}

//Leitura dos profilesLabel 
function profilesLabel(params,callback) {
  params.label = params.label?params.label:{};
  var Schema = app.models.Schema;
  Schema.find({where:{"class":"ProfilesLabel",language:params.language}},function(err,profilesLabel) {
    profilesLabel.forEach(function(item) {
      var parsedId = item.id.split(":");
      var domId = parsedId[1]+":"+parsedId[2]+":"+parsedId[3]
      params.label[domId] = item.field;
    });
    callback();
  });
}

//profilesLabel individual para o glossário
app.get('/profile/glossary/individual/:base/:id', function(req, res) {
  var template = fs.readFileSync('./client-bigno/glossary.mustache', 'utf8');
  var Schema = app.models.Schema;
  Schema.findById(req.params.id,function(err,schema) {
    if(typeof schema.images != "undefined" && schema.images.length>0){
      schema.image = schema.images[0].resized;
    } else {
      schema.image = false;
    }
    if(schema.class == "State"){
      schema.subtitle = schema.category+" : "+schema.field;
    } else{
      schema.subtitle = schema.category;
    }
    if(schema.references && schema.references.length>0){
      Schema.findById(req.params.id.split(":")[0]+":bigno:ProfilesLabel:profilesBibliographicReferences",function(err,label) {      
        if(label)
        schema.referenceLabel = label.field;
        schema.references = schema.references.map(function(item) {
          return {ref:item};
        });
        schema.base = req.params.base?req.params.base:"bigno";
        res.send(mustache.render(template, schema));
      });
    } else {
      schema.references = false;
      schema.base = req.params.base?req.params.base:"bigno";
      res.send(mustache.render(template, schema));   
    }            
  });
});

//Tradução da pagina de glossário
app.get('/profile/glossary/:base/:lang*?', function(req, res){
  var template = fs.readFileSync('./client-bigno/general_glossary.mustache', 'utf8');
  var params = {lang: req.params.lang, base: req.params.base?req.params.base:"bigno"};
  res.send(mustache.render(template, params));
});

//Página de glossário
app.get('/profile/glossary/:base', function(req, res){
  var template = fs.readFileSync('./client-bigno/general_glossary.mustache', 'utf8');
  var params = {base:req.params.base?req.params.base:"bigno"};
  res.send(mustache.render(template, params));
});

//Tradução da pagina About
app.get('/profile/about/:base/:lang*?', function(req, res){
  var template = fs.readFileSync('./client-bigno/sobre.mustache', 'utf8');
  var params = {lang: req.params.lang, base: req.params.base?req.params.base:"bigno"};
  res.send(mustache.render(template, params));
});

//Página About
app.get('/profile/about/:base', function(req, res){
  var template = fs.readFileSync('./client-bigno/sobre.mustache', 'utf8');
  var params = {base:req.params.base?req.params.base:"bigno"};
  res.send(mustache.render(template, params));
});

//Tradução da pagina Contato
app.get('/profile/contact/:base/:lang*?', function(req, res){
  var template = fs.readFileSync('./client-bigno/contato.mustache', 'utf8');
  var params = {lang: req.params.lang, base: req.params.base?req.params.base:"bigno"};
  res.send(mustache.render(template, params));
});

//Página Contato
app.get('/profile/contact/:base', function(req, res){
  var template = fs.readFileSync('./client-bigno/contato.mustache', 'utf8');
  var params = {base:req.params.base?req.params.base:"bigno"};
  res.send(mustache.render(template, params));
});

var ds = loopback.createDataSource({
    connector: require('loopback-component-storage'),
    provider: 'filesystem',
    root: __dirname+'/../storage'
});

var container = ds.createModel('storage');
app.model(container);

// Bootstrap the application, configure models, datasources and middleware.
// Sub-apps like REST API are mounted via boot scripts.
boot(app, __dirname, function(err) {
  if (err) throw err;

  // start the server if `$ node server.js`
  if (require.main === module)
    app.start();
});
