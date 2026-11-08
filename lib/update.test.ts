import {test} from 'node:test';
import {equal} from 'node:assert/strict';
import {hasNewerVersion} from './update.ts';
test('Update-Hinweise unterscheiden Hotfixes von alten, gleichen und ungültigen Versionen',()=>{
 equal(hasNewerVersion('1.5.0','1.5.1'),true);equal(hasNewerVersion('1.5.9','1.6.0'),true);equal(hasNewerVersion('1.5.0','1.5.0'),false);equal(hasNewerVersion('1.5.0','1.4.99'),false);
 for(const value of [null,{},'1.5','javascript:alert(1)','999999999999999999.5.0'])equal(hasNewerVersion('1.5.0',value),false);
});
