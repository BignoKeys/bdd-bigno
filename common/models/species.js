var async = require('async');
var hash = require('object-hash');
var request = require('request');
var readChunk = require('read-chunk'); 
var imageType = require('image-type');  
var xlsx = require('node-xlsx');
var request = require('request');
var fs = require('fs');
var qt = require('quickthumb');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

module.exports = function(Species) {

  //Agregação de species, pela base e pelo nome científico
  Species.fromSpecimensAggregation = function(base,filter,cb) {
    async.parallel([
      function en(callback) {
        //seleciona os nomes científicos
        selectScientificNames(base,"en-US",filter,function (scientificNames) {
          //gera as especies 
          generateSpecies(base,"en-US",scientificNames,function(species) {
            callback();
          });
        });
      },
      function pt(callback) {
        selectScientificNames(base,"pt-BR",filter,function (scientificNames) {
          generateSpecies(base,"pt-BR",scientificNames,function(species) {
            callback();
          });
        });
      // },
      // function es(callback) {
      //   selectScientificNames(base,"es-ES",filter,function (scientificNames) {
      //     generateSpecies(base,"es-ES",scientificNames,function(species) {
      //       callback();
      //     });
      //   });
     }
    ],function done() {
      cb(null,"done");
    });
  };

  Species.remoteMethod(
    'fromSpecimensAggregation',
    {
      http: {path: '/fromSpecimensAggregation', verb: 'get'},
      accepts: [
        {arg: 'base', type: 'string', required:true},
        {arg: 'filter', type: 'array', required:false}
      ],
      returns: {arg: 'response', type: 'object'}
    }
  );

  //Gera as species
  function generateSpecies(base,language,sciName,cb) {
    //pega as especimes
    var Specimen = Species.app.models.Specimen;
    var count = 0;
    async.each(sciName, function iterator(name, callback){
      //seleciona as especimes com os nomes cientificos
      var query = {where:{}};
      query.where[language+":dwc:Taxon:scientificName.value"] = name; //seleciona o nome científico para cada linguagem
      query.where.base = base; //seleciona a base
      Specimen.find(query, function (err,specimens) {
        console.log(specimens);

        var species = {}; //especies a serem salvas no banco de dados
        species.specimens = []; //especimes relacionadas 
        species["language"] = language; //linguagem       
        species[language+":dwc:Taxon:genus"] = specimens[0][language+":dwc:Taxon:genus"]; //Familia da especie
        species.base = base; //base pertecente
        species[language+":dwc:Taxon:scientificName"] = specimens[0][language+":dwc:Taxon:scientificName"]; //nome científico
        species[language+":dwc:Taxon:scientificNameAuthorship"] = specimens[0][language+":dwc:Taxon:scientificNameAuthorship"]; //nome dos autores
        // TODO multiple specimens with different popular names
        species[language+":dwc:Taxon:taxonRank"] = specimens[0][language+":dwc:Taxon:taxonRank"]; //nome usual

        species[language+":bigno:Sample:phenology"] = specimens[0][language+":bigno:Sample:phenology"]; 
        species[language+":bigno:Image:vegetativeFeaturesImage"] = specimens[0][language+":bigno:Image:vegetativeFeaturesImage"]; //TODO isso é uma caracteristica da especie ou do especime?
        species[language+":bigno:Image:fruitImage"] = specimens[0][language+":bigno:Image:fruitImage"];
        species[language+":bigno:Image:flowerImage"] = specimens[0][language+":bigno:Image:flowerImage"];
        species[language+":bigno:Image:ecologyImage"] = specimens[0][language+":bigno:Image:ecologyImage"];
        species[language+":bigno:Image:distributionImage"] = specimens[0][language+":bigno:Image:distributionImage"];
        species[language+":bigno:Image:excicataImage"] = specimens[0][language+":bigno:Image:excicataImage"];
        specimens.forEach(function (sp) {
          species.specimens.push({id:sp.id});
          Object.keys(sp).forEach(function(key,index) {
            if(key!='__cachedRelations'&&key!='__data'&&key!='__dataSource'&&key!='__strict'&&key!='__persisted'){
              if(sp[key].class=="CategoricalDescriptor"){
                if(species[key]){
                  species[key].states.concat(sp[key].states);
                }else{
                  species[key] = sp[key];
                }
              } else if(sp[key].class=="NumericalDescriptor"){
                if(!species[key]){
                  var values = sp[key].value.split(";");
                  species[key] = sp[key];
                  if(values.length != 4){
                    console.log("problema com valor numerico:");
                    console.log(key);
                    // console.log(species[key]);
                  } else {
                    var min = parseFloat(values[0].trim().slice(4).replace(",","."));
                    var max = parseFloat(values[1].trim().slice(4).replace(",","."));
                    var avg = parseFloat(values[2].trim().slice(4).replace(",","."));
                    var sd = parseFloat(values[2].trim().slice(4).replace(",","."));
                    species[key].numerical = {min: min, max: max, avg:avg, sd:sd};
                  }
                }
              } else if(sp[key].class=="Reference"){
                if(species[key]){
                  species[key].references.concat(sp[key].references);
                }else{
                  species[key] = sp[key];
                }
              } else if(sp[key].class=="Image"){
                if(species[key]){
                  species[key].images.concat(sp[key].images);
                }else{
                  species[key] = sp[key];
                }
              }
            }
          });
        });
        species.id = Species.app.defineSpeciesID(language,base,name);
        Species.upsert(species,function (err,instance) {
          if(err)
            console.log(err);
          count++;
          callback();
        });
      });
    }, function done(){
      cb(count);
    });
  }
  
  //Seleciona espécimes de mesmo nome científico
  function selectScientificNames(base, language,filter,cb) {
    var Specimen = Species.app.models.Specimen;
    var sp = Specimen.getDataSource().connector.collection(Specimen.modelName);
    sp.aggregate({'$match':{'language': language,base:base}},{
      $group: {
        _id: { value: '$'+language+':dwc:Taxon:scientificName.value'}
      }
    }, function(err, groupByRecords) {
      if(err) {
        console.log(err,groupByRecords);
      } else {
        cb(groupByRecords.map(function(item) {
          //console.log("Resultado da consulta: ", item._id.value);
          return item._id.value;
        }));
      }
    });
  }

  /**********************************************************************************
  ************* Modificações para chaves interativas de Bignoneacea *****************
  ***********************************************************************************/

  //Funções novas para species retiradas de specimen, para leitura da ficha de species
  var logs = {};

  Species.inputFromURL = function(url,language, base, cb) {
    //substitui a url da imagem
    url = url.replace("https://drive.google.com/open?id=","https://docs.google.com/uc?id=");
    var name = defineName(url); //define o nome da url
    if(name==null)
    cb("Invalid XLSX file.",null);
    var path = __dirname +"/../../uploads/"+name+".xlsx"; //define o caminho do arquivo
    saveDataset(name,url,path); //salva os dados
    //ler o arquivo da planilha
    var w = fs.createWriteStream(path).on("close",function (argument) {
      var data = xlsx.parse(path)[0].data; //recebe os dados
      var schema = data[0]; //define o schema
      var class_ = data[1]; //define a classe
      var terms = data[2]; //define o termo
      // var category = data[3];
      var label = data[4]; //define o rotulo      
      data =  data.slice(5,data.length); //recebe a quantidade de dados da planilha      
      var response = {}; //resposta de execução
      response.count = 0;

      async.each(data,function(line, callback){ //para cada linha lida salve os dados
        if(line && line.length>0){          
          async.series([
          function(callbackSave) {
            // console.log("start en-US",line);
            //para salvar em  inglês
            saveRecord(base, language,"en-US",line, schema, class_, terms, function() {
              // console.log("finish en-US");
              callbackSave();
            });
          },
          function(callbackSave) {
            // console.log("start pt-BR", line);
            //para salvar em português
            saveRecord(base, language,"pt-BR",line, schema, class_, terms, function() {
              // console.log("finish pt-BR");
              callbackSave();
            });
          }
        ],function done() {
          console.log("COUTING: ",response.count++);
          callback(); //retorno da função
        });     
        } else {
          callback(); //retorno da função
        }      
      },function() {
        //executa o download das imagens
       // downloadImages(downloadQueue, redownload);
        console.log("Done.");
        for (var key in logs) {
          console.log(logs[key]);
        }

        cb(null, response);
      });        
    });    
    request(url).pipe(w);
  };

  //Salvar os dados de species na base
  function saveRecord(base, originalLanguage,language,line, schema, class_, terms, callback) {
    var Schema = Species.app.models.Schema; //usando o schema
    var c = 0;

    //var record = {}; //dados as serem gravados no banco
    //record.id = Species.app.defineSpeciesID(language,line[1],line[2],line[3]); //definição do id do specimen

    var species = {}; //especies a serem gravadas no banco 
    species.specimens = []; //espécimes a serem agregadas se houver ficha de espécimes 
    species.id =  Species.app.defineSpeciesID(language,base,line[2]);
    if(species.id){   //se o id existir execute
      //para termo da planilha
      async.each(terms, function(term, callbackCell){
        c++;
        //se existe o termo e a linha existe da amostra
        if(term && toString(line[c]) != ""){
          var schemaId = Species.app.defineSchemaID(language,schema[c],class_[c],terms[c]); //define o id do esquema
          species.language = language; //recebe a linguagem
          species.originalLanguage = originalLanguage;  //linguagem original
          species[schemaId] = {value:toString(line[c])}; //recebe o valor da linha que esta sendo lida
          species.base = base;
          if(schemaId){ //se existe id definido no esquema
            Schema.findById(schemaId,function(err,schema) { //busca o id que está no schema
              if(err) //se existe erro na busca
                console.log(err);
              if(schema){ //se existe schema
                var value = toString(species[schema.id].value); //pega o valor do schema
                species[schema.id] = schema;
                // CATEGORICAL DESCRIPTOR
                if(schema["class"]=="CategoricalDescriptor"){
                  species[schema.id].value = value;
                  species[schema.id].states = [];

                  async.each(value.split("|"), function(sValue, callbackState) {
                    var stateValue = titleCase(sValue.trim());
                    if(language==originalLanguage){
                    //  SAME LANGUAGE
                      if(stateValue.length>0){

                        Schema.findOne({where:{language:originalLanguage,class:"State",field:schema.field,state:stateValue}}, function(err,state) {
                          if(state){
                            species[schema.id].states.push(state.toJSON());
                          }else {
                            logs[hash.MD5("STATE NOT FOUND Field: "+schema.field+"State: "+stateValue)] = "STATE NOT FOUND\tField: "+schema.field+"\tState: "+stateValue;
                          }
                          callbackState();
                        });
                      } else {
                        logs[hash.MD5("EMPTY STATE Field: "+schema.field)] = "STATE NOT FOUND\tField: "+schema.field;
                        callbackState();
                      }
                    } else {
                    // DIFFERENT LANGUAGES
                      var schemaIdOriginal = Species.app.defineSchemaID(originalLanguage,schema.schema,schema["class"],schema.term);
                      Schema.findById(schemaIdOriginal,function(err,schemaOriginal) {
                        if(schemaOriginal){

                          Schema.findOne({where:{language:originalLanguage,class:"State",field:schemaOriginal.field,state:stateValue}}, function(err,state) {
                            if(state){
                              Schema.findById(Schema.app.defineSchemaID(language, state.schema, state.class, state.term),function(err,translatedState) {
                                if(translatedState){
                                  species[schema.id].states.push(translatedState.toJSON());
                                } else{
                                  logs[hash.MD5("STATE NOT FOUND "+"Field: "+schema.field+"State: "+stateValue)] = "STATE NOT FOUND\tField: "+schema.field+"\tState: "+stateValue;
                                }
                                callbackState();
                              });
                            } else {
                              logs[hash.MD5("STATE NOT FOUND Field: "+schemaOriginal.field+"State: "+stateValue)] = "STATE NOT FOUND\tField: "+schemaOriginal.field+"\tState: "+stateValue;
                              callbackState();
                            }
                          });
                        } else {
                          console.log("NOT FOUND: ",schemaIdOriginal);
                          callbackState();
                        }
                      });
                    }
                  },function doneState() {
                    callbackCell();
                  });
                // OTHER FIELDS
                } else {
                  species[schema.id].value = value;
                  // IMAGE
                  //encontra class image no schema
                  if(schema["class"]=="Image"){ //se encontrar a classe da imagem
                    //recebe um vetor de images
                    species[schema.id].images = [];
                    species[schema.id].value.split("|").forEach(function(img,i){
                        var imageId = schema.id.split(":").slice(1).join(":")+":"+species.id.split(":").slice(1).join(":")+":"+i;
                        var image = {
                          id: imageId,
                          // name: "specimen_" + img.replace("https://drive.google.com/open?id=", ""),
                          original: img.replace("https://drive.google.com/open?id=","https://docs.google.com/uc?id="),
                          local: "/images/" + imageId + ".jpeg", //atribui a url onde vai ser salva a imagem
                          resized: "/resized/" + imageId + ".jpeg", //atribui a url onde vai ser salva a imagem
                          thumbnail: "/thumbnails/" + imageId + ".jpeg" //atribui a url onde vai ser salva a imagem
                        }
                        species[schemaId].images.push(image);
                    });

                  }else
                  // REFERENCE
                  if(schema["class"]=="Reference"){
                    species[schema.id].references = [];
                    species[schema.id].value.split("|").forEach(function (ref) {
                      species[schema.id].references.push(ref.trim());
                    });
                  }
                  callbackCell();
              }
            } else {
                callbackCell();
              }
            });
          } else {
            callbackCell();
          }
        } else {
          callbackCell();
        }
      },function done() {
        Species.upsert(species,function (err,instance) {
          if(err)
            console.log(err);
          callback();
        });
      });
    } else {
      console.log("Cannot define an ID for species: ",language,base,line[2]);
      callback();
    }
  }

  Species.cleanDB = function(cb) {
    Species.destroyAll(function (err,callback) {
      cb(err,callback);
    });
  };

  Species.getCollection = function(code, cb) {
    Species.getApp(function(err, app){
      if (err) throw new Error(err);
      var Collection = app.models.Collection;
      var filter = {"dwc\:collectionCode.value": code};
      Collection.find({where: filter}, function(err, collection){
        if (err) throw new Error(err);
        cb(null, collection);
      });
    });
  };

  Species.remoteMethod(
    'cleanDB',
    {
      http: {path: '/clean', verb: 'get'},
      accepts: [
      ],
      returns: {arg: 'response', type: 'object'}
    }
  );

  Species.remoteMethod(
    'getCollection',
    {
      http: {path: '/getCollection', verb: 'get'},
      accepts: [
        {arg: 'code', type: 'string', required:true}
      ],
      returns: {arg: 'response', type: 'object'}
    }
  );

  Species.remoteMethod(
    'inputFromURL',
    {
      http: {path: '/xlsx/inputFromURL', verb: 'get'},
      accepts: [
        {arg: 'url', type: 'string', required:true, description: 'link para tabela de espécies'},
        {arg: 'language', type: 'string', required:true, description: 'en-US ou pt-BR'},
        {arg: 'base', type: 'string', required:true, description: 'bigno'}
       // {arg: 'redownload', type: 'boolean', required:false, description: 'true para baixar todas as imagens. false para baixar somente imagens novas. default: false', default: false}
      ],
      returns: {arg: 'response', type: 'object'}
    }
  );

  //Funções auxiliares
  function toString(arg) {
    return (typeof arg == 'undefined')?'':String(arg).trim();
  }

  function defineId(line,idIndexes) {
    var idValue = '';
    for(var j = 0; j < idIndexes.length; j++){
      /*if(toString(line[idIndexes[j]])=='')
      return null;*/
      idValue = idValue+":"+ String(line[idIndexes[j]]).trim();
    };
    if (idValue == ":::")
      return null;
    return hash.MD5(idValue);
  }

  function defineName(url) {
    if(url.indexOf("?id=")!=-1)
    var name = url.split("?id=")[1];
    else if(url.indexOf(".xls")!=-1)
    name = hash.MD5(url);
    else return null;
    return name;
  }

  function saveDataset(name,url,path) {
    var Dataset = Species.app.models.Dataset;
    var dataset = {};
    dataset.id = name;
    dataset.urlSource = url;
    dataset.localSource = path;
    dataset.type = "Species";
    Dataset.upsert(dataset,function (err,instance) {
      if (err) throw new Error(err);
      //console.log("Dataset saved: "+instance.id);
    });
  }

  function isNumeric (str){
    return validator.isFloat(str);
  };

  function titleCase(string) {
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
  }

  Species.downloadImages = function (cb) {
    //Schema aqui vai realizar uma consulta no banco de dados pegando os valores chave e valor do registro.
    //Pelo record.image (que vai conter a url de download da image) e record.id (identificador do documento)
    //Onde a imagem vai ser salva na pasta do cliente
    var startTime = new Date();
    Species.find({where:{or:[{"pt-BR:bigno:Image:vegetativeFeaturesImage":{exists:true}},{"pt-BR:bigno:Image:flowerImage":{exists:true}},
    {"pt-BR:bigno:Image:fruitImage":{exists:true}},{"pt-BR:bigno:Image:ecologyImage":{exists:true}},{"pt-BR:bigno:Image:distributionImage":{exists:true}}, {"pt-BR:bigno:Image:excicataImage":{exists:true}}]},
    fields:{"pt-BR:bigno:Image:vegetativeFeaturesImage":true,"pt-BR:bigno:Image:flowerImage":true,
    "pt-BR:bigno:Image:fruitImage":true, "pt-BR:bigno:Image:ecologyImage":true,"pt-BR:bigno:Image:distributionImage":true,"pt-BR:bigno:Image:excicataImage":true}}, function(err,results){    
      
      var i = 0;
      console.time("download");
      var queue = async.queue(function(img,callback) {
        console.log("PROCESSED: ",i++);
        console.timeEnd("download");
        var downloader = new ImageDownloader(); 
        downloader.download(img,callback);
      },5);

      results.forEach(function (result){
        if(result["pt-BR:bigno:Image:vegetativeFeaturesImage"]){
            result["pt-BR:bigno:Image:vegetativeFeaturesImage"].images.forEach(function (img){
             queue.push(img);
            });
        }
        if(result["pt-BR:bigno:Image:flowerImage"]){
            result["pt-BR:bigno:Image:flowerImage"].images.forEach(function (img){
              queue.push(img);
            });
        }
        if(result["pt-BR:bigno:Image:fruitImage"]){
            result["pt-BR:bigno:Image:fruitImage"].images.forEach(function (img){
              queue.push(img);
            });
        }
        if(result["pt-BR:bigno:Image:ecologyImage"]){
            result["pt-BR:bigno:Image:ecologyImage"].images.forEach(function (img){
             queue.push(img);
            });
        }
        if(result["pt-BR:bigno:Image:distributionImage"]){
            result["pt-BR:bigno:Image:distributionImage"].images.forEach(function (img){
              queue.push(img);
            });
        }
        if(result["pt-BR:bigno:Image:excicataImage"]){
            result["pt-BR:bigno:Image:excicataImage"].images.forEach(function (img){
              queue.push(img);
            });
        }
      });            
    });
  };
  function ImageDownloader() {
    EventEmitter.call(this);
    this.log = [];
    this.count = 0;    
    this.requestErrorCount = 0;
  }
  util.inherits(ImageDownloader, EventEmitter);
  ImageDownloader.prototype.download = function(img,callback) {    
    var self = this;    
    var image = new Image(img);     
    image.checkIfExist(image.localPath,function(exists) {      
      if(exists) image.emit("exists"); 
      else image.emit("doesNotExist");
    });
    image.on("exists", function() {
        console.log("Existe original "+image.local);        
        self.count++;        
        image.checkIfExist(image.thumbnailPath,function(exists) {
          if(exists){      
            console.log("Existe thumbnail "+image.thumbnailPath);              
            image.checkIfExist(image.resizedPath,function(exists) {
              if(exists) {
                console.log("Existe resized "+image.thumbnailPath); 
                callback();                 
              }
              else image.emit("localFileWrote");
            });
          } else {
            image.emit("localFileWrote");
          }
        });            
      })
    .on("doesNotExist",image.requestFromURL)
    .on("endDownload", function() {
          image.writeLocalFile();
          self.count++;            
      })
    .on("localFileWrote",
      function() {        
        image.convertResized().on("resizedFileWrote",function() {
          image.convertThumbnail().on("thumbnailFileWrote",function() {
            callback();
          });          
        });        
        // self.log = self.log.concat(image.log)
      })
    .on("writeError",function() {
      callback();
    });
    return this;
  };
  function Image(img) {    
    EventEmitter.call(this);
    this.log = [];
    this.count = 0;
    this.img = img;
    this.requestErrorCount = 0;
    this.writeLocalErrorCount = 0;
    this.writeResizedErrorCount = 0;
    this.writeThumbnailErrorCount = 0;
    this.original = img.original;
    this.local = img.local;
    this.resized = img.resized;
    this.thumbnail = img.thumbnail;
    this.localPath = __dirname + "/../../client-bigno"+this.local;
    this.thumbnailPath = __dirname + "/../../client-bigno"+this.thumbnail;
    this.resizedPath = __dirname + "/../../client-bigno"+this.resized;
  }
  util.inherits(Image, EventEmitter);
  Image.prototype.checkIfExist = function(path,cb) {
    var self = this;
    fs.exists(path, function(exists){
      cb(exists);        
    });
    // return this;
  };
  Image.prototype.requestFromURL = function() {
    var self = this;
    request(self.original, {encoding: 'binary'}, function(err, response, body){
      if (err){
        if (self.requestErrorCount==10) {
          console.log("Error to download "+self.original);
          self.requestErrorCount == 0;
          self.log.push("Error no download de "+self.original);
          return self.emit("endDownload");
        } else {
          self.requestErrorCount++;
          self.requestFromURL();
        }
      } else {
        self.downloadedContent = body;
        return self.emit("endDownload");
      }
    });
    return this;
  }
  Image.prototype.writeLocalFile = function() {    
    var self = this;
    fs.writeFile("client-bigno"+self.local, self.downloadedContent, 'binary', function(err){
        if(err){
          if(self.writeLocalErrorCount==10){
            console.log("******** Local: "+self.local);
            console.log('Ops, um erro ocorreu!');
            console.log("URL: ",self.original);
            console.log("********");
            self.log.push("Write Local File: "+self.local+"   URL: "+self.original);
            self.writeLocalErrorCount = 0;
          } else {
            self.writeLocalErrorCount++
            self.writeLocalFile();
          }
        } else {
          var buffer = readChunk.sync("client-bigno"+self.local, 0, 120);  
          //Checar se a imagem salva é um arquivo jpeg, caso não seja requisitar o endereço da imagem novamente
          if (imageType(buffer)==null){
            if(self.writeLocalErrorCount==10){              
              console.log("******** Local: "+self.local);
              console.log('Ops, um erro ocorreu!');
              console.log("URL: ",self.original);
              console.log("********");
              self.log.push("Write Local File: "+self.local+"   URL: "+self.original);
              self.writeLocalErrorCount = 0;
              self.emit("writeError");
            } else {
              self.writeLocalErrorCount++
              self.writeLocalFile();
            }
          }else{            
            self.emit("localFileWrote");
          }  
        }
    });
    return this;
  }
  Image.prototype.convertResized = function() {
    var self = this;
    qt.convert({src:self.localPath, dst: self.resizedPath, width:1500}, function(err, filename){
      if(err){
        if(self.writeResizedErrorCount==3){
          console.log("******** RESIZED: "+self.resized);
          console.log('Ops, um erro ocorreu!');
          console.log("******** Local: "+self.local);
          console.log("URL: ",self.original);
          console.log("********");
          self.log.push("Write Resized File: "+self.resized+"   Local: "+self.local+"   URL: "+self.original);
          self.writeResizedErrorCount = 0;
          self.emit("writeError");
        } else {
          self.writeResizedErrorCount++
          self.convertResized();
        }
      } else {        
        self.emit("resizedFileWrote");
      }
    });
    return this;
  }
  Image.prototype.convertThumbnail = function() {
    var self = this;
    qt.convert({src:self.resizedPath, dst: self.thumbnailPath, width:100, height:100}, function(err, filename){
      if(err){
        if(self.writeThumbnailErrorCount==3){
          console.log("******** THUMBNAIL: "+self.thumbnail);
          console.log('Ops, um erro ocorreu!');
          console.log("******** Local: "+self.local);
          console.log("URL: ",self.original);
          console.log("********");
          self.log.push("Write Thumbnail File: "+self.thumbnail+"   Local: "+self.local+"   URL: "+self.original);
          self.writeThumbnailErrorCount = 0;
          self.emit("writeError");
        } else {
          self.writeThumbnailErrorCount++
          self.convertThumbnail();
        }
      } else {        
        self.emit("thumbnailFileWrote");
      }
    });
    return this;
  }

  Species.remoteMethod(
    'downloadImages',
    {
      http: {path: '/downloadImages', verb: 'get'},
      accepts: [
        // {arg:'download'}
        // {arg: 'download', type: 'boolean', required:true, description: 'true para baixar todas as imagens. false para baixar somente imagens novas. default: false', default: true}
      ],
      returns: {arg: 'response', type: 'object'}
    }
  );
  //Criar função pra agregar ficha de especie com fichas de especimes

};
