var path = require("path");

// Making resharper less noisy - These are defined in Generate.js
if (typeof (templatizeTree) === "undefined") templatizeTree = function () { };
if (typeof (getCompiledTemplate) === "undefined") getCompiledTemplate = function () { };

exports.makeClientAPI2 = function (apis, sourceDir, apiOutputDir) {
    var locals = {
        apis: apis,
        buildIdentifier: exports.buildIdentifier,
        errorList: apis[0].errorList,
        errors: apis[0].errors,
        friendlyName: "PlayFab Python Client Sdk",
        sdkVersion: exports.sdkVersion
    };

    console.log("Generating Client api from: " + sourceDir + " to: " + apiOutputDir);

    templatizeTree(locals, path.resolve(sourceDir, "source"), apiOutputDir);

    for (var i = 0; i < apis.length; i++)
        makeApi(apis[i], sourceDir, apiOutputDir);
    generateSimpleFiles(apis, sourceDir, apiOutputDir);
}


exports.makeServerAPI = function (apis, sourceDir, apiOutputDir) {
    var locals = {
        apis: apis,
        buildIdentifier: exports.buildIdentifier,
        errorList: apis[0].errorList,
        errors: apis[0].errors,
        friendlyName: "PlayFab Python Server Sdk",
        sdkVersion: exports.sdkVersion
    };

    console.log("Generating Server api from: " + sourceDir + " to: " + apiOutputDir);
    templatizeTree(locals, path.resolve(sourceDir, "source"), apiOutputDir);

    for(var i=0; i< apis.length; i++)
        makeApi(apis[i], sourceDir, apiOutputDir);

    generateSimpleFiles(apis, sourceDir, apiOutputDir);
}

exports.makeCombinedAPI = function (apis, sourceDir, apiOutputDir) {
    var locals = {
        apis: apis,
        buildIdentifier: exports.buildIdentifier,
        errorList: apis[0].errorList,
        errors: apis[0].errors,
        friendlyName: "PlayFab Python Combined Sdk",
        sdkVersion: exports.sdkVersion
    };

    console.log("Generating Combined Client/Server api from: " + sourceDir + " to: " + apiOutputDir);

    templatizeTree(locals, path.resolve(sourceDir, "source"), apiOutputDir);
    for (var i = 0; i < apis.length; i++)
        makeApi(apis[i], sourceDir, apiOutputDir);
    generateSimpleFiles(apis, sourceDir, apiOutputDir);
}

// Unlike source, Templates are written one file at a time.
// You may want to write a helper function to write each template file, so you can call it from multiple places
function MakeExampleTemplateFile(sourceDir, apiOutputDir) {
    // Each template must be given any variables/information that it needs for generation.
    // This might include apis, datatypes, custom functions defined in this make.js file, or anything else you want
    var locals = {};

    locals.GeneratedText = "This is generated text"; // A specific variable we wish to access in exampleTemplate.txt.ejs
    locals.sdkVersion = exports.sdkVersion; // exports.sdkVersion is automatically injected into this file from generate.js, and comes from SdkManualNotes.json - you must provide your target in that file

    // Compiles the source .ejs file into a template function.
    var template = getCompiledTemplate(path.resolve(sourceDir, "templates/exampleTemplate.txt.ejs"));

    // Call the template function, which executes the template, and evaluates all the ejs tags/logic
    var generatedTemplateText = template(locals);

    // generatedTemplateText is an in-memory string of the output file.  At this point, you just write it to the destination:
    writeFile(path.resolve(apiOutputDir, "exampleTemplate.txt"), generatedTemplateText);
}

function makeDataTypes(apis, sourceDir, apiOutputDir) {
    var modelTemplate = getCompiledTemplate(path.resolve(sourceDir, "templates/Model.py.ejs"));
    var modelsTemplate = getCompiledTemplate(path.resolve(sourceDir, "templates/Models.py.ejs"));
    var enumTemplate = getCompiledTemplate(path.resolve(sourceDir, "templates/Enum.py.ejs"));
    var jsonTemplate = getCompiledTemplate(path.resolve(sourceDir, "templates/PlayFabJson.py.ejs"));

    var makeDatatype = function (datatype, api) {
        var modelLocals = {
            api: api,
            datatype: datatype,
            multiTab: multiTab,
            generateApiSummary: generateApiSummary,
            getModelPropertyDef: getModelPropertyDef,
            getPropertyAttribs: getPropertyAttribs,
            getBaseTypeSyntax: getBaseTypeSyntax,
            getDeprecationAttribute: getDeprecationAttribute,
            getDefaultValueForType: getDefaultValueForType,
            addInitializeFunction: addInitializeFunction,
            getJsonSerialization: getJsonSerialization,
            getComparator: getComparator,
        };

        writeFile(path.resolve(apiOutputDir, "source/PlayFabJson.py"), jsonTemplate(modelLocals));

        return (datatype.isenum) ? enumTemplate(modelLocals) : modelTemplate(modelLocals);
    };

    for (var a = 0; a < apis.length; a++) {
        var modelsLocal = {
            api: apis[a],
            makeDatatype: makeDatatype
        };

        writeFile(path.resolve(apiOutputDir, "source/PlayFab" + apis[a].name + "Models.py"), modelsTemplate(modelsLocal));
    }
}

function makeApi(api, sourceDir, apiOutputDir) {
    console.log("Generating Python " + api.name + " library to " + apiOutputDir);

    var apiLocals = {
        api: api,
        multiTab: multiTab,
        getAuthParams: getAuthParams,
        getRequestActions: getRequestActions,
        getResultActions: getResultActions,
        getDeprecationAttribute: getDeprecationAttribute,
        getComparator: getComparator,
        getDefaultValueForType: getDefaultValueForType,
        generateApiSummary: generateApiSummary,
        addInitializeFunction: addInitializeFunction,
        //commentOutClassesWithoutProperties: commentOutClassesWithoutProperties,
        getJsonSerialization: getJsonSerialization,
        hasClientOptions: api.name === "Client"
    };

    var apiTemplate = getCompiledTemplate(path.resolve(sourceDir, "templates/API.py.ejs"));
    writeFile(path.resolve(apiOutputDir, "source/PlayFab" + api.name + "API.py"), apiTemplate(apiLocals));
}

function generateSimpleFiles(apis, sourceDir, apiOutputDir) {
    var errorLocals = {};
    errorLocals.errorList = apis[0].errorList;
    errorLocals.errors = apis[0].errors;

    var errorsTemplate = getCompiledTemplate(path.resolve(sourceDir, "templates/Errors.py.ejs"));
    writeFile(path.resolve(apiOutputDir, "source/PlayFabErrors.py"), errorsTemplate(errorLocals));

    var settingsLocals = {};
    settingsLocals.hasServerOptions = false;
    settingsLocals.hasClientOptions = false;
    settingsLocals.sdkVersion = exports.sdkVersion;
    settingsLocals.buildIdentifier = exports.buildIdentifier;
    for (var i = 0; i < apis.length; i++) {
        if (apis[i].name === "Client")
            settingsLocals.hasClientOptions = true;
        else
            settingsLocals.hasServerOptions = true;
    }
}

function getDeprecationAttribute(tabbing, apiObj) {
    var isDeprecated = apiObj.hasOwnProperty("deprecation");
    var deprecationTime = null;
    if (isDeprecated)
        deprecationTime = new Date(apiObj.deprecation.DeprecatedAfter);
    var isError = isDeprecated && (new Date() > deprecationTime) ? "true" : "false";

    if (isDeprecated && apiObj.deprecation.ReplacedBy != null)
        return tabbing + "# [Obsolete(\"Use '" + apiObj.deprecation.ReplacedBy + "' instead\", " + isError + ")]\n";
    else if (isDeprecated)
        return tabbing + "# [Obsolete(\"No longer available\", " + isError + ")]\n";
    return "";
}

function getBaseTypeSyntax(datatype) {
    var parents = [];
    
    if (datatype.className.toLowerCase().endsWith("request"))
        parents.push("PlayFabHTTP.PlayFabRequestCommon");
    if (datatype.className.toLowerCase().endsWith("response") || datatype.className.toLowerCase().endsWith("result"))
        parents.push("PlayFabHTTP.PlayFabResultCommon");
    else {
        parents.push("PlayFabHTTP.PlayFabBaseObject");
    }

    //parents.push("PlayFabHTTP.Serializable")

    if (parents.length > 0) {
        var output = "(";
        for (var i = 0; i < parents.length; i++) {
            if (i !== 0)
                output += ", ";
            output += parents[i];
        }
        output += ")"
    }
    return output;
}

function getPropertyAttribs(tabbing, property, datatype, api) {
    var attribs = "";

    if (property.isUnordered) {
        var listDatatype = api.datatypes[property.actualtype];
        if (listDatatype && listDatatype.sortKey)
            attribs += tabbing + "# [Unordered(SortProperty=\"" + listDatatype.sortKey + "\")]\n";
        else
            attribs += tabbing + "# [Unordered]\n";
    }

    return attribs;
}

function getModelPropertyDef(property, datatype) {
    var basicType;
    if (property.collection) {
        //basicType = getPropertyCsType(property, datatype, false);

        //if (property.collection === "array")
        //    return "List<" + basicType + "> " + property.name;
        //else if (property.collection === "map")
        //    return "Dictionary<string," + basicType + "> " + property.name;
        //else
        //    throw "Unknown collection type: " + property.collection + " for " + property.name + " in " + datatype.name;
    }
    else {
        //basicType = getPropertyCsType(property, datatype, true);
        //return basicType + " " + property.name;
    }
    return property.name;
}

function getAuthParams(apiCall) {
    if (apiCall.url === "/Authentication/GetEntityToken")
        return "authKey, authValue";
    if (apiCall.auth === "EntityToken")
        return "\"X-EntityToken\", PlayFabSettings._internalSettings.EntityToken";
    if (apiCall.auth === "SecretKey")
        return "\"X-SecretKey\", PlayFabSettings.DeveloperSecretKey";
    else if (apiCall.auth === "SessionTicket")
        return "\"X-Authorization\", PlayFabSettings._internalSettings.ClientSessionTicket";
    return "None, None";
}

function getRequestActions(tabbing, apiCall) {
    if (apiCall.result === "LoginResult" || apiCall.request === "RegisterPlayFabUserRequest")
        return tabbing + "request[\"TitleId\"] = PlayFabSettings.TitleId or request.TitleId\n"
            + tabbing + "if not request[\"TitleId\"]:\n"
            + tabbing + "    raise PlayFabErrors.PlayFabException(\"Must be have TitleId set to call this method\")\n";
    if (apiCall.auth === "EntityToken")
        return tabbing + "if not PlayFabSettings._internalSettings.EntityToken:\n "
            + tabbing + "    raise PlayFabErrors.PlayFabException(\"Must call GetEntityToken before calling this method\")\n";
    if (apiCall.auth === "SessionTicket")
        return tabbing + "if not PlayFabSettings._internalSettings.ClientSessionTicket:\n"
            + tabbing + "    raise PlayFabErrors.PlayFabException(\"Must be logged in to call this method\")\n";
    if (apiCall.auth === "SecretKey")
        return tabbing + "if not PlayFabSettings.DeveloperSecretKey:\n"
            + tabbing + "    raise PlayFabErrors.PlayFabException(\"Must have DeveloperSecretKey set to call this method\")\n";
    if (apiCall.url === "/Authentication/GetEntityToken")
        return tabbing + "authKey = None\n"
            + tabbing + "authValue = None\n"
            + tabbing + "if PlayFabSettings._internalSettings.EntityToken:\n"
            + tabbing + "    authKey = \"X-EntityToken\"\n"
            + tabbing + "    authValue = PlayFabSettings._internalSettings.EntityToken\n"
            + tabbing + "elif PlayFabSettings._internalSettings.ClientSessionTicket:\n"
            + tabbing + "    authKey = \"X-Authorization\"\n"
            + tabbing + "    authValue = PlayFabSettings._internalSettings.ClientSessionTicket \n"
            + tabbing + "elif PlayFabSettings.DeveloperSecretKey:\n"
            + tabbing + "    authKey = \"X-SecretKey\"\n"
            + tabbing + "    authValue = PlayFabSettings.DeveloperSecretKey \n";
    return "";
}

function getResultActions(tabbing, apiCall, api) {
    if (apiCall.result === "LoginResult")
        return tabbing + "PlayFabSettings._internalSettings.ClientSessionTicket = playFabResult[\"SessionTicket\"] or PlayFabSettings._internalSettings.ClientSessionTicket\n"
            + tabbing + "PlayFabSettings._internalSettings.EntityToken = playFabResult[\"EntityToken\"][\"EntityToken\"] or PlayFabSettings._internalSettings.EntityToken\n"
            + tabbing + "MultiStepClientLogin(playFabResult[\"SettingsForUser\"])\n";
    else if (apiCall.result === "RegisterPlayFabUserResult")
        return tabbing + "PlayFabSettings._internalSettings.ClientSessionTicket = playFabResult[\"SessionTicket\"] or PlayFabSettings._internalSettings.ClientSessionTicket\n"
            + tabbing + "MultiStepClientLogin(playFabResult[\"SettingsForUser\"])\n";
    else if (api.name === "Client" && apiCall.result === "AttributeInstallResult")
        return tabbing + "# Modify AdvertisingIdType:  Prevents us from sending the id multiple times, and allows automated tests to determine id was sent successfully\n"
            + tabbing + "PlayFabSettings.AdvertisingIdType += \"_Successful\"\n";
    else if (apiCall.result === "GetEntityTokenResponse")
        return tabbing + "PlayFabSettings._internalSettings.EntityToken = playFabResult[\"EntityToken\"] or PlayFabSettings._internalSettings.EntityToken\n";
    return "";
}

function getDeprecationAttribute(tabbing, apiObj) {
    var isDeprecated = apiObj.hasOwnProperty("deprecation");
    var deprecationTime = null;
    if (isDeprecated)
        deprecationTime = new Date(apiObj.deprecation.DeprecatedAfter);
    var isError = isDeprecated && (new Date() > deprecationTime) ? "true" : "false";

    if (isDeprecated && apiObj.deprecation.ReplacedBy != null)
        return tabbing + "# [Obsolete(\"Use '" + apiObj.deprecation.ReplacedBy + "' instead\", " + isError + ")]\n";
    else if (isDeprecated)
        return tabbing + "# [Obsolete(\"No longer available\", " + isError + ")]\n";
    return "";
}

function generateApiSummary(tabbing, apiElement, summaryParam, extraLines) {
    var lines = generateApiSummaryLines(apiElement, summaryParam, extraLines);

    var output;
    if (lines.length === 1) {
        output = tabbing + "# " + lines.join("\n" + tabbing + "# ") + "\n";
    } else if (lines.length > 0) {
        output = tabbing + "# " + lines.join("\n" + tabbing + "# ") + "\n";
    } else {
        output = "";
    }
    return output;
}

function getComparator(tabbing, dataTypeName, dataTypeSortKey)
{
    //var output = multiTab(tabbing, 3) + "def __eq__(self, " + dataTypeName + " other):\n" +
    var output = multiTab(tabbing, 2) + "def __eq__(self, other):\n" +
        multiTab(tabbing, 3) + "if other == None or other." + dataTypeSortKey + " == None:\n" +
        multiTab(tabbing, 4) + "return 1\n" +
        multiTab(tabbing, 3) + "if " + dataTypeSortKey + " == None:\n" +
        multiTab(tabbing, 4) + "return -1\n"+
        multiTab(tabbing, 3) + "return "+dataTypeSortKey+".__eq__(self."+dataTypeSortKey+", other."+dataTypeSortKey+")\n";

    return output;
}

function multiTab(tabbing, numTabs)
{
    var finalTabbing = "";
    while (numTabs != 0)
    {
        finalTabbing += tabbing;
        numTabs--;
    }
    return finalTabbing;
}

function getDefaultValueForType(property, datatype) {

    if (property.jsontype === "Number")
        return "0";
    if (datatype.jsontype === "String")
        return "\"\"";
    if(datatype.JsonType === "Object" && datatype.isOptional)
        return "None";
    //if(datatype.JsonType === "Object")
    //    return "new " + ?namespace ? + datatype.actualtype + "()";
    if(datatype.JsonType === "Object")
        return "new " + datatype.actualtype + "()";

    if (property.actualtype === "String")
        return "\"\"";
    else if (property.actualtype === "Boolean")
        return "False";
    else if (property.actualtype === "int16")
        return "0";
    else if (property.actualtype === "uint16")
        return "0";
    else if (property.actualtype === "int32")
        return "0";
    else if (property.actualtype === "uint32")
        return "0";
    else if (property.actualtype === "int64")
        return "0";
    else if (property.actualtype === "uint64")
        return "0";
    else if (property.actualtype === "float")
        return "0.0";
    else if (property.actualtype === "double")
        return "0.0";
    else if (property.actualtype === "DateTime")
        return "datetime.date.today()";
    else if (property.isclass)
        return property.actualtype;
    else if (property.isenum) //TODO: figure out default enum or val at 0
        return property.actualtype;
    else if (property.actualtype === "object")
        return "None";
    else
        throw "Unknown property type: " + property.actualtype + " for " + property.name + " in " + datatype.name;
}

function addInitializeFunction(tabbing, propertySize)
{
    return tabbing + (propertySize > 0 ? "def __init__(self):" : "def __init__(self):\n"+tabbing+"    pass");
}

//function commentOutClassesWithoutProperties(tabbing, propertyCount)
//{
//    if (propertyCount == 0)
//    {
//        return tabbing + "# This class has no properties, and cannot be instantiated in python.\n"+tabbing+"#";
//    }
//}
function getJsonSerialization(tabbing, properties)
{
    var def = tabbing+"def fromJson(json):\n" + tabbing + "    return {";

    //// iterate through properties and add them to this dictionary

    //return def + "\n"+tabbing+"    }";
}