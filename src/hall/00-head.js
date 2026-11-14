/*
 * Librarium Archives: the 3D hall, exhibits, camera and play table.
 * Needs three.js r128 (global THREE) and js/rules.js (global LibrariumRules).
 */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const wait = ms => new Promise(r => setTimeout(r, reduceMotion ? ms * 0.5 : ms));

