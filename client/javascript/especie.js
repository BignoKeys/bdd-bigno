function readSpecies(id, map){
  var lang = localStorage.language?localStorage.language:"pt-BR";
  $.getJSON("/api/Species/"+id, function(data){
    // titulo
    var name = data[lang+":dwc:Taxon:scientificName"].value + " " + data[lang+":dwc:Taxon:scientificNameAuthorship"].value;
    document.title = "RCPol - "+name;
    Object.keys(data).forEach(function(key) {
      var parsedId = key.split(":");
      var schema = parsedId.length==4?parsedId[1]:"";
      var class_ = parsedId.length==4?parsedId[2]:"";
      var term = parsedId.length==4?parsedId[3]:"";
      var base = schema+"-"+class_+"-"+term;
      if(term=="pollenSize"){       
        if(data[key].states){
          $("#"+base+"-label").append(data[key].field+": ");
          if(data[key].states.length==1){
            $("#"+base+"-value").append(data[key].states[0].state);
          } else {            
            var order = ["pollenSizeVerySmall","pollenSizeSmall","pollenSizeMedium","pollenSizeLarge","pollenSizeVeryLarge","pollenSizeGiant"];
            var lowestIndex = Infinity;
            var highestIndex = -1;                        
            var lowestValue = "?";
            var highestValue = "?";                        
            data[key].states.forEach(function(state) {              
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
            var sep = data.language=='en-US'?' to ':' a ';
            $("#"+base+"-value").append(lowestValue+sep+highestValue);
          }            
        }
      } else if(term=="pollenShape"){        
        if(data[key].states){
          $("#"+base+"-label").append(data[key].field+": ");
          if(data[key].states.length==1){
            $("#"+base+"-value").append(data[key].states[0].state);
          } else {            
            var order = ["pollenShapePeroblate","pollenShapeOblate","pollenShapeSuboblate","pollenShapeOblateSpheroidal","pollenShapeSpheroidal","pollenShapeProlateSpheroidal","pollenShapeSubprolate", "pollenShapeProlate", "pollenShapePerprolate"];
            var lowestIndex = Infinity;
            var highestIndex = -1;                        
            var lowestValue = "?";
            var highestValue = "?";                        
            data[key].states.forEach(function(state) {              
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
            var sep = data.language=='en-US'?' to ':' a ';
            $("#"+base+"-value").append(lowestValue+sep+highestValue);
          }            
        }
      } else if(term=="flowerSize"){        
        if(data[key].states){
          $("#"+base+"-label").append(data[key].field+": ");
          if(data[key].states.length==1){
            $("#"+base+"-value").append(data[key].states[0].state);
          } else {
            var order = ["flowerSizeVerySmall","flowerSizeSmall","flowerSizeMedium","flowerSizeLarge","flowerSizeVeryLarge"];            
            var lowestIndex = Infinity;
            var highestIndex = -1;                        
            var lowestValue = "?";
            var highestValue = "?";                        
            data[key].states.forEach(function(state) {              
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
            var sep = data.language=='en-US'?' to ':' a ';
            $("#"+base+"-value").append(lowestValue+sep+highestValue);           
          }            
        }
      } else if(parsedId.length==4 && class_!="NumericalDescriptor"){        
        if(data[key].value && !data[key].states && !data[key].months){
          $("#"+base+"-label").append(data[key].field+": ");
          $("#"+base+"-value").append(data[key].value);
        }
        if(data[key].states){
          data[key].states.forEach(function(state) {
            $("#"+base+"-value").append(state.state).append(", ");
          });
          var aux = $("#"+base+"-value").html() || "";
          if(aux.length>0){
            $("#"+base+"-label").append(data[key].field+": ");
            $("#"+base+"-value").html(
              aux.substring(0,aux.length-2)
            );
          }
        }
        if(data[key].months){
          data[key].months.forEach(function(month) {
            $("#"+base+"-value").append(month).append(", ");
          });
          var aux = $("#"+base+"-value").html() || "";
          if(aux.length>0){
            $("#"+base+"-label").append(data[key].field+": ");
            $("#"+base+"-value").html(
              aux.substring(0,aux.length-2)
            );
          }
        }
      } else if(class_=="NumericalDescriptor"){
        if(data[key].field && data[key].state && data[key].state.numerical && data[key].state.numerical.min && data[key].state.numerical.max){
          if(data[key].term == "pollenShapePE"){
            var pos = data[key].field.toLowerCase().indexOf("p/e");
            var before = data[key].field.substring(0,pos);
            var after = data[key].field.substring(pos+3,data[key].field.length);
            var aux = before+"P/E"+after;
            $("#"+base+"-label").append(aux+": ");
          } else
            $("#"+base+"-label").append(data[key].field+": ");
          $("#"+base+"-value").append("Min: "+data[key].state.numerical.min+" / Max: "+data[key].state.numerical.max +
          (data[key].state.numerical.med?" / Avg: "+data[key].state.numerical.avg:"")+
          (data[key].state.numerical.sd?" / SD: "+data[key].state.numerical.sd:"")
          );
        }
      }
    });
    // IMAGES
    if(data[lang+':rcpol:Image:plantImage'] && data[lang+':rcpol:Image:plantImage'].images && data[lang+':rcpol:Image:plantImage'].images.length>0)
      data[lang+":rcpol:Image:plantImage"].images.forEach(function(media){
          $("#foto_planta").append("<img src='" +media.resized+"'/>");
          $("#foto_planta img").attr("style", "max-width:500px; max-height:400px;");
      });
    if(data[lang+':rcpol:Image:flowerImage'] && data[lang+':rcpol:Image:flowerImage'].images && data[lang+':rcpol:Image:flowerImage'].images.length>0)
      data[lang+":rcpol:Image:flowerImage"].images.forEach(function(media){
          $("#foto_planta").append("<img src='" +media.resized+"'/>");
          $("#foto_planta img").attr("style", "max-width:500px; max-height:400px;");
      });
    if(data[lang+':rcpol:Image:pollenImage'] && data[lang+':rcpol:Image:pollenImage'].images && data[lang+':rcpol:Image:pollenImage'].images.length>0)
      data[lang+":rcpol:Image:pollenImage"].images.forEach(function(media){
          $("#foto_polen").append("<img src='" +media.resized+"'/>");
      });
    if(data[lang+':rcpol:Image:allPollenImage'] && data[lang+':rcpol:Image:allPollenImage'].images && data[lang+':rcpol:Image:allPollenImage'].images.length>0)
      data[lang+":rcpol:Image:allPollenImage"].images.forEach(function(media){
          $("#foto_polen").append("<img src='" +media.resized+"'/>");
      });
    $(".fotorama").fotorama();
    // mapa
    map.attributionControl.addAttribution('<a href="./' + id + '"">Ocorrências de ' + name  +'</a>');
    //especimes
    var specimen_ids = data.specimens.map(function(elem){return elem.id;});
    var specimen_query = "filter[fields]["+lang+":dwc:RecordLevel:institutionCode]=true&filter[fields]["+lang+":dwc:RecordLevel:catalogNumber]=true&filter[fields]["+lang+":dwc:Location:decimalLatitude]=true&filter[fields]["+lang+":dwc:Location:decimalLongitude]=true&filter[fields]["+lang+":dwc:RecordLevel:collectionCode]=true&filter[fields]["+lang+":dwc:Occurrence:recordedBy]=true&filter[fields]["+lang+":dwc:Location:municipality]=true&filter[fields]["+lang+":dwc:Location:stateProvince]=true&filter[fields][id]=true&filter[where][id][inq]=" + specimen_ids[0];
    specimen_ids.forEach(function(id){
      specimen_query += "&filter[where][id][inq]=" + id;
    });

    $.getJSON("/api/Specimens?" + specimen_query, function(specimens){
      specimens.forEach(function(specimen, id){        
        // mapa
        var p = [specimen[lang+":dwc:Location:decimalLatitude"].value, specimen[lang+":dwc:Location:decimalLongitude"].value];
        var marker = L.marker(p, {opacity:0.9}).addTo(map);
        $.getJSON("/api/Collections/"+lang+"%3A"+specimen[lang+":dwc:RecordLevel:institutionCode"].value+"%3A"+specimen[lang+":dwc:RecordLevel:collectionCode"].value,
            function(collection){
              w2ui['grid'].add(
                {
                recid: specimen[lang+":dwc:RecordLevel:catalogNumber"].value,
                scientificName: "<i>"+name+"</i>",
                collectionName: ((collection[lang+":rcpol:Collection:collectionName"]?collection[lang+":rcpol:Collection:collectionName"].value:"")+" - "+(specimen[lang+":dwc:RecordLevel:institutionCode"]?specimen[lang+":dwc:RecordLevel:institutionCode"].value:"")),
                recordedBy: specimen[lang+":dwc:Occurrence:recordedBy"].value,
                municipality: specimen[lang+":dwc:Location:municipality"].value + " - " + specimen[lang+":dwc:Location:stateProvince"].value,
                specimen_id: specimen.id}
              );
            });
        });
    });

  });
};
