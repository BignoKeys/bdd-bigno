var coordinates = {};
function readSpecimen(id,base,cb){

  var lang = localStorage.language?localStorage.language:"pt-BR";
  $.getJSON("/api/Specimens/"+id, function(data){
    console.log(data);
    coordinates.lat = data[lang+":dwc:Location:decimalLatitude"].value;
    coordinates.lng = data[lang+":dwc:Location:decimalLongitude"].value;
    var name = data[lang+":dwc:Taxon:scientificName"].value + " " + data[lang+":dwc:Taxon:scientificNameAuthorship"].value;
    document.title = "Bigno - "+name;
    Object.keys(data).forEach(function(key) {
      var parsedId = key.split(":");
      var schema = parsedId.length==4?parsedId[1]:"";
      var class_ = parsedId.length==4?parsedId[2]:"";
      var term = parsedId.length==4?parsedId[3]:"";
      var base = schema+"-"+class_+"-"+term; 

    // IMAGES
    if(data[lang+':bigno:Image:vegetativeFeaturesImage'] && data[lang+':bigno:Image:vegetativeFeaturesImage'].images && data[lang+':bigno:Image:vegetativeFeaturesImage'].images.length>0)
      data[lang+":bigno:Image:vegetativeFeaturesImage"].images.forEach(function(media){
          $("#foto_planta").append("<img src='" +media.resized+"'/>");
          $("#foto_planta img").attr("style", "max-width:500px; max-height:400px;");
      });
    if(data[lang+':bigno:Image:flowerImage'] && data[lang+':bigno:Image:flowerImage'].images && data[lang+':bigno:Image:flowerImage'].images.length>0)
      data[lang+":bigno:Image:flowerImage"].images.forEach(function(media){
          $("#foto_planta").append("<img src='" +media.resized+"'/>");
          $("#foto_planta img").attr("style", "max-width:500px; max-height:400px;");
      });
    if(data[lang+':bigno:Image:fruitImage'] && data[lang+':bigno:Image:fruitImage'].images && data[lang+':bigno:Image:fruitImage'].images.length>0)
      data[lang+":bigno:Image:fruitImage"].images.forEach(function(media){
          $("#foto_planta").append("<img src='" +media.resized+"'/>");
      });
    if(data[lang+':bigno:Image:ecologyImage'] && data[lang+':bigno:Image:ecologyImage'].images && data[lang+':bigno:Image:ecologyImage'].images.length>0)
      data[lang+":bigno:Image:ecologyImage"].images.forEach(function(media){
          $("#foto_planta").append("<img src='" +media.resized+"'/>");
      });
    if(data[lang+':bigno:Image:distributionImage'] && data[lang+':bigno:Image:distributionImage'].images && data[lang+':bigno:Image:distributionImage'].images.length>0)
      data[lang+":bigno:Image:distributionImage"].images.forEach(function(media){
          $("#foto_planta").append("<img src='" +media.resized+"'/>");
      });
    $(".fotorama").fotorama();

    var bib = data[lang+":bigno:Reference:reference"];
    if(bib){
      bib = !(Array.isArray(bib))?[bib]:bib;
      bib.forEach(function(citation){
        citation.references.forEach(function(referencia){
         $("#referencias").append('<p>' + referencia + '</p>');
       });
      });
    }
    var bib = data[lang+":bigno:Reference:polinizationReference"];
    if(bib){
      bib = !(Array.isArray(bib))?[bib]:bib;
      bib.forEach(function(citation){
        citation.references.forEach(function(referencia){
         $("#referencias").append('<p>' + referencia + '</p>');
       });
      });
    }
    var bib = data[lang+":bigno:Reference:domatiaReference"];
    if(bib){
      bib = !(Array.isArray(bib))?[bib]:bib;
      bib.forEach(function(citation){
        citation.references.forEach(function(referencia){
         $("#referencias").append('<p>' + referencia + '</p>');
       });
      });
    }
    var codigo_institution = data[lang+":dwc:RecordLevel:institutionCode"].value;
    var codigo_palinoteca = data[lang+":dwc:RecordLevel:collectionCode"].value;    

    $.getJSON("/api/Specimens/getCollection?code="+codigo_palinoteca, function(res){
      console.log(res);
      var palinoteca = res.response[0];
      if (palinoteca["bigno:laboratory"]) $("#laboratorio").append("do " + palinoteca["bigno:laboratory"].value);
      $("#instituicao").append(palinoteca["bigno:institutionName"].value);
      $("#codigoDaInstituicao").append(palinoteca["bigno:institutionName"].value+" (").append(palinoteca["dwc:institutionCode"].value+")");
      $("#colecao").append(palinoteca["bigno:collectionName"].value+" (").append(codigo_palinoteca+")");
      $("#responsavel").append(palinoteca["bigno:responsable"].value);
      $("#endereco").append(palinoteca["bigno:address"].value);
      $("#telefone").append(palinoteca["bigno:telephone"].value);
      $("#email").append(palinoteca["bigno:email"].value);
      $("#homepage").append(palinoteca["bigno:homepage"].value);
      $("#homepage_link").attr("href", palinoteca["bigno:homepage"].value);
      $("#link_palinoteca").attr("href", "/profile/palinoteca/"+base+"/"+palinoteca["id"]);
      if(palinoteca["bigno:logotipo"].url)
        $("#logo").attr("src", palinoteca["bigno:logotipo"].url);
      // console.log(palinoteca["rcpol:logotipo"].url);
    });
    
  });
    cb(); 
  });
}
