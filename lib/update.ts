export function hasNewerVersion(current: string, remote: unknown): remote is string {
  const valid=(value:unknown):value is string=>typeof value==='string'&&/^\d{1,5}\.\d{1,5}\.\d{1,5}$/.test(value);
  if(!valid(current)||!valid(remote))return false;
  const a=current.split('.').map(Number),b=remote.split('.').map(Number);
  for(let i=0;i<3;i++)if(a[i]!==b[i])return b[i]>a[i];
  return false;
}
