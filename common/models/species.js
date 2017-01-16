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

  // Imagem principal das species - para comentar
  Species.mainImage = function(id,cb) {
    Species.findById(id, function (err, data) {
      if(err) throw new Error(err);
      var url = "";
      if(data["dwc:associatedMedia"]){ //Midia associada - mudar schema para bigno
        // ensure it is an array
        var associatedMedia = data["dwc:associatedMedia"];
        if (!(Array.isArray(associatedMedia))) associatedMedia = [associatedMedia];
        if(associatedMedia.length>0){
          associatedMedia.forEach(function(media){
            if (media.category == "Flor"){ //para categoria Flor 
              var url = "/thumbnails/" + media.name + ".jpg";
              cb(err, url);
            }
          });
        } else {
          cb(err, url);
        }
      } else {
        cb(err, url);
      }
    });
  };

  Species.remoteMethod(
    'mainImage',
    {
      http: {path: '/mainImage', verb: 'get'},
      accepts: [
        {arg: 'id', type: 'array', required:true}
      ],
      returns: {arg: 'response', type: 'string'}
    }
  );

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
      },
      function es(callback) {
        selectScientificNames(base,"es-ES",filter,function (scientificNames) {
          generateSpecies(base,"es-ES",scientificNames,function(species) {
            callback();
          });
        });
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
  function generateSpecies(base, language,sciName,cb) {
    //pega as especimes
    var Specimen = Species.app.models.Specimen;
    var count = 0;
    async.each(sciName, function iterator(name, callback){
      //seleciona as especimes com os nomes cientificos
      var query = {where:{}};
      query.where[language+":dwc:Taxon:scientificName.value"] = name; //seleciona o nome científico para cada linguagem
      query.where.base = base; //seleciona a base
      Specimen.find(query, function (err,specimens) {

        var species = {};
        species.specimens = [];
        species["language"] = language;        
        species[language+":dwc:Taxon:family"] = specimens[0][language+":dwc:Taxon:family"];
        species.base = base;
        species[language+":dwc:Taxon:scientificName"] = specimens[0][language+":dwc:Taxon:scientificName"];
        species[language+":dwc:Taxon:scientifimcNameAuthorship"] = specimens[0][language+":dwc:Taxon:scientificNameAuthorship"];
        // TODO multiple specimens with different popular names
        species[language+":dwc:Taxon:vernacularName"] = specimens[0][language+":dwc:Taxon:vernacularName"];

        species[language+":dwc:Occurrence:establishmentMean"] = specimens[0][language+":dwc:Occurrence:establishmentMean"];
        species[language+":rcpol:Sample:floweringPeriod"] = specimens[0][language+":rcpol:Sample:floweringPeriod"]; //TODO isso é uma caracteristica da especie ou do especime?
        species[language+":rcpol:Image:plantImage"] = specimens[0][language+":rcpol:Image:plantImage"];
        species[language+":rcpol:Image:flowerImage"] = specimens[0][language+":rcpol:Image:flowerImage"];
        species[language+":rcpol:Image:beeImage"] = specimens[0][language+":rcpol:Image:beeImage"];
        species[language+":rcpol:Image:pollenImage"] = specimens[0][language+":rcpol:Image:pollenImage"];
        species[language+":rcpol:Image:allPollenImage"] = specimens[0][language+":rcpol:Image:allPollenImage"];
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
          return item._id.value;
        }));
      }
    });
  }

  /**********************************************************************************
  ************* Modificações para chaves interativas de Bignoneacea *****************
  ***********************************************************************************/
  //função de seleção de especies
  // function selectScientificNameSpecies(base, language, filter, cb){

  //   var species = Species.app.models.Species;

  //   species.aggregate({'match':{'language': language, base: base}},{
  //     $group:{
  //       _id: {value: '$'+language+':dwc:Taxon:scientificName.value'}
  //     }
  //   }, function(err, groupByRecords){
  //     if(err){
  //       console.log(err,groupByRecords)
  //     }else{
  //       cb(groupByRecords.map(function(item){
  //         return item._id.value;
  //       }));
  //     }
  //   });

  // }


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
    var record = {}; //dados as serem gravados no banco
    record.id = Species.app.defineSpeciesID(language,line[1],line[2],line[3]); //definição do id do specimen
    if(record.id){   //se o id existir execute
      //para termo da planilha
      async.each(terms, function(term, callbackCell){
        c++;
        //se existe o termo e a linha existe da amostra
        if(term && toString(line[c]) != ""){
          var schemaId = Species.app.defineSchemaID(language,schema[c],class_[c],terms[c]); //define o id do esquema
          record.language = language; //recebe a linguagem
          record.originalLanguage = originalLanguage;  //linguagem original
          record[schemaId] = {value:toString(line[c])}; //recebe o valor da linha que esta sendo lida
          record.base = base;
          if(schemaId){ //se existe id definido no esquema
            Schema.findById(schemaId,function(err,schema) { //busca o id que está no schema
              if(err) //se existe erro na busca
                console.log(err);
              if(schema){ //se existe schema
                var value = toString(record[schema.id].value); //pega o valor do schema
                record[schema.id] = schema;
                // CATEGORICAL DESCRIPTOR
                if(schema["class"]=="CategoricalDescriptor"){
                  record[schema.id].value = value;
                  record[schema.id].states = [];
                  async.each(value.split("|"), function(sValue, callbackState) {
                    var stateValue = titleCase(sValue.trim());
                    if(language==originalLanguage){
                    //  SAME LANGUAGE
                      if(stateValue.length>0){
                        Schema.findOne({where:{language:originalLanguage,class:"State",field:schema.field,state:stateValue}}, function(err,state) {
                          if(state){
                            record[schema.id].states.push(state.toJSON());
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
                                  record[schema.id].states.push(translatedState.toJSON());
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
                  record[schema.id].value = value;
                  // IMAGE
                  //encontra class image no schema
                  if(schema["class"]=="Image"){ //se encontrar a classe da imagem
                    //recebe um vetor de images
                    record[schema.id].images = [];
                    record[schema.id].value.split("|").forEach(function(img,i){
                        var imageId = schema.id.split(":").slice(1).join(":")+":"+record.id.split(":").slice(1).join(":")+":"+i;
                        var image = {
                          id: imageId,
                          // name: "specimen_" + img.replace("https://drive.google.com/open?id=", ""),
                          original: img.replace("https://drive.google.com/open?id=","https://docs.google.com/uc?id="),
                          local: "/images/" + imageId + ".jpeg", //atribui a url onde vai ser salva a imagem
                          resized: "/resized/" + imageId + ".jpeg", //atribui a url onde vai ser salva a imagem
                          thumbnail: "/thumbnails/" + imageId + ".jpeg" //atribui a url onde vai ser salva a imagem
                        }
                        record[schemaId].images.push(image);
                    });

                  }else
                  // REFERENCE
                  if(schema["class"]=="Reference"){
                    record[schema.id].references = [];
                    record[schema.id].value.split("|").forEach(function (ref) {
                      record[schema.id].references.push(ref.trim());
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
        Species.upsert(record,function (err,instance) {
          if(err)
            console.log(err);
          callback();
        });
      });
    } else {
      console.log("Cannot define an ID for species: ",language,line[1],line[2],line[3]);
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


  //Criar função pra agregar ficha de especie com fichas de especimes

};
