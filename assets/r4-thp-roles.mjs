// Compare two measured THP values without changing train eligibility rules.
// The Train Desk uses the latest recorded THP as of today in server time, not the train date.
export function latestThpSnapshotDate(now=new Date()){
 return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Noronha',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}

export function roleForPair(conductor,vip){
 if(!Number.isSafeInteger(conductor)||conductor<0||!Number.isSafeInteger(vip)||vip<0)return null;
 if(conductor>vip)return 'Special Guest';
 if(conductor<vip)return 'Guest Defender';
 return 'Equal THP';
}
