// Compare two measured THP values without changing train eligibility rules.
export function roleForPair(conductor,vip){
 if(!Number.isSafeInteger(conductor)||conductor<0||!Number.isSafeInteger(vip)||vip<0)return null;
 if(conductor>vip)return 'Special Guest';
 if(conductor<vip)return 'Guest Defender';
 return 'Equal THP';
}
