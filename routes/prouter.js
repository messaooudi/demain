var express=require('express');
var prouter=express.Router();
var async = require('async');
var conEnsure=require('connect-ensure-login');
var multer=require('multer');
//-----models---------------
var User=require("../models/User");
var Rat=require("../models/rattrappage");
var Matiere=require("../models/Matiere");
var Notes=require("../models/Notes");
var Module=require("../models/Module");

//no backup !!!!!!!!
//===============================afficher mes notes=======================================
prouter.get('/list',conEnsure.ensureLoggedIn(1,"/login"),function(req,res){
	var list  =[];
 var niveau=parseInt(req.query.niv);
 var fil   =req.query.fil;
 var liste =[];
	User.findOne({_id:req.user._id},{matieres:1}).populate(
   {
    path    :'matieres',
    model   :'Matiere',
    match   :{$and:[{filiere:fil},{niveau:niveau},{semestre:req.user.active_semestre}]},
    populate:{path:"notes"}
   }
  ).exec(function(err,doc){
		  if(!err){
					 if(doc && doc.matieres && doc.matieres.length!=0){
       console.log(
        "---------------get : /list------------------"+
        JSON.stringify({mats:doc.matieres})+
        "--------------------------------------------"
       );
       async.each(doc.matieres,function(matiere,done){
         var iJson={}; 
         iJson.nom   =matiere.nom        ;
         iJson.notes =matiere.notes.liste;
         iJson.niveau=matiere.niveau     ;
         liste.push(iJson);
         /*'liste' entry format:
          *{
          *  nom    :"nom_matiere",
          *  notes  :{e0:19.5,e1:18.99,e2:19.78,.....},
          *  niveau :___,
          *  filiere:___
          *}
          */
       },function(err){
          res.status(200).json({liste:liste});
       });
      }    
      else 
							    res.status(404).json({err:"aucune matière ! ajouter des matière !"});
				} else res.status(500).json({err:"erreur de connexion"});
	});
});

//==============config de multer=============================================================
var storage=multer.diskStorage({
              destination:function(req,file,cb){
                  cb(null,'./uploads');
              },         
              filename   :function(req,file,cb){
                  cb(null,file.fieldname+".csv");
              }
            });
var upload=multer({storage:storage});


//===============charger un note==================================

prouter.post('/charger',conEnsure.ensureLoggedIn(1,"/login"),upload.single('note'),function(req,res){

var Converter =require("csvtojson").Converter;
var converter = new Converter({flatKeys:true});
var matRegx=new RegExp(/^[a-zA-Z ]{3,}$/);
var mat=req.body.mat;
var subject={};
var notes;
var currentProf={};
  //if(req.user.matiere[mat]) {matiereexiste=true;break;}
	if(!matRegx.test(mat)) res.render("error",{err:"pas de caractères speciaux!"});
 else if(typeof req.file=="undefined")
      res.render("error",{title:"error",err:"vous devez choisir un fichier  csv!"});
 else{
				converter.fromFile("uploads/"+req.file.filename,function(err,jsonArray){
     //cette boucle transforme le tableau d'objets json retourné en un objet json 
     //compatible avec la structure de données dans mongo
     async.each(jsonArray,function(item,callback){
      subject[item["nom/prenom"]]=item["note"];
			   async.setImmediate(function(){
				   callback();
			   });
			  },function(err){
				   if(typeof mat=="undefined" || mat=="") res.redirect("/telecharger");
       else{
        Matiere.findOne({$and:[{nom:mat},{_ens:req.user._id}]})
        .populate({path:"notes",model:"Notes"})
        .exec(function(err,matiere){
         if(!err) {
           if(!matiere) res.json({err:"error , nom de matiere invalide !"});
           else if(matiere.notes.editable){
            notes=new Notes({_elm:matiere,liste:subject});
            matiere.notes =notes;
            notes.save(function(err){
              if(!err){
               matiere.save(function(err){
                if(!err) res.json({ok:"données ajoutées avec succes !"});
                else res.json({err:"Rien n'est ajouté !"});
               });
              }else res.json({err:"error , can't save !"});
            });
           }else res.json({err:"vous ne pouvez pas modifier !"});
         }else res.json({err:"user not found !"});
        });
       }
     });
    });
 }});

 //=====================================modifier une note================================

prouter.post('/modifier',conEnsure.ensureLoggedIn(1,"/login"),function(req,res){

  var regx    =new RegExp(/^([0-1]?[0-9]\.[0-9]{1,2}|20\.0{1,2})$/);
	 var mat     =req.body.mat;     //nom de la matiere
  var filiere =req.body.filiere;//la filiere 
  var nom     =req.body.nom;   //nom de l'eleve
	 var note    =parseFloat(req.body.note);
		var found   =false;
  if(!mat|| mat=="" || !regx.test(req.body.note))res.render("error",{err:"vous devez choisir une matière"});
	 else if(note>20.0||note<0.0)res.render("error",{title:"note invalide",err:"la note doit être entre 0 et 20 !"});
	 else{
			User.findOne({_id:req.user._id}).populate(
    {
     path    :"matieres",
     match   :{$and:[{nom:nom},{filiere:filiere}]},
     populate:{path:"notes"}
    }
   ).exec(function(err,elm){
     if(!err){
      if(elm.notes.liste[nom]){
         elm.notes.liste[nom]=note;
         elm.save(function(err){
         if(!err){
              res.json({ok :""});
         }else 
              res.json({err:"une erreur s'est produite , reessayer"});
        });
      }else 
           res.json({err:"ce nom d'eleve n'existe pas"});
     }else 
           res.json({err:"une erreur de connexion"});   
			});
	 }
});

module.exports=prouter;