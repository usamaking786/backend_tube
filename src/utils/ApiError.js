class ApiError extends Error {
    constructor(statusCode, message , error = [], statck = ""){
        super(message);
        this.statusCode = statusCode;
        this.message= message;
        this.data = null;
        this.success = false;
        this.error = error;
        if(statck){
            this.statck = statck;
        }
        else{
            Error.captureStatckTrace(this,this.constructor)
        }
    }
}

export default ApiError