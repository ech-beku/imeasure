declare module "helper/DojoWidget" {

    class DojoWidget {
        public templatePath: string;
        public domNode: HTMLElement;

        constructor(mixinOptions: any, templatePath: string);
    }

    export = DojoWidget;
}

declare module "helper/Levensthein" {


    function get(string1: string, string2: string, options: any): number;

    //class LST 
    //{
    //}

}