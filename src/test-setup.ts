import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// vitest の globals を使っていないので、描画の後始末を自分で登録する
afterEach(cleanup);
